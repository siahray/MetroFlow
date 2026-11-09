"""
HTTP/SSE latency benchmark for NFR-001, NFR-002 and NFR-019.

Needs the API already running and reachable (e.g. ``docker compose up -d
postgres redis backend``), seeded with the default dispatcher account.

Run:  python3 -m benchmarks.bench_latency [--base-url http://localhost:8000]
"""

import argparse
import json
import statistics
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor


def _post(base_url, path, body, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        base_url + path, data=json.dumps(body).encode(), headers=headers, method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def _get(base_url, path, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with urllib.request.urlopen(urllib.request.Request(base_url + path, headers=headers)) as r:
        return json.load(r)


def _summarize(samples):
    samples = sorted(samples)
    p95 = samples[min(len(samples) - 1, int(0.95 * len(samples)))]
    return {
        "n": len(samples),
        "median_ms": round(statistics.median(samples), 1),
        "p95_ms": round(p95, 1),
        "max_ms": round(max(samples), 1),
    }


def bench_endpoint(base_url, path, token, n=60, workers=8):
    def one():
        t0 = time.perf_counter()
        _get(base_url, path, token)
        return (time.perf_counter() - t0) * 1000.0

    with ThreadPoolExecutor(max_workers=workers) as ex:
        samples = [f.result() for f in [ex.submit(one) for _ in range(n)]]
    return _summarize(samples)


def bench_sse_delivery(base_url, token, n=40, timeout_s=5):
    """Time from a hazard POST to the matching frame on /hazards/stream."""
    req = urllib.request.Request(
        base_url + "/api/v1/hazards/stream", headers={"Authorization": f"Bearer {token}"}
    )
    stream = urllib.request.urlopen(req)

    def read_until_name(target_name, deadline):
        frame_lines = []
        while time.perf_counter() < deadline:
            line = stream.readline()
            if not line:
                continue
            if line.strip() == b"":
                data_line = next(
                    (frame for frame in frame_lines if frame.startswith(b"data:")), None
                )
                frame_lines = []
                if not data_line:
                    continue
                try:
                    evt = json.loads(data_line[len(b"data:") :].strip())
                except ValueError:
                    continue
                if evt.get("name") == target_name:
                    return time.perf_counter()
            else:
                frame_lines.append(line)
        return None

    samples = []
    for i in range(n):
        marker = f"bench-sse-{i}-{time.time_ns()}"
        t0 = time.perf_counter()
        _post(base_url, "/api/v1/hazards", {"name": marker, "obstruction_level": "partial"}, token)
        t1 = read_until_name(marker, deadline=time.perf_counter() + timeout_s)
        if t1 is not None:
            samples.append((t1 - t0) * 1000.0)
    stream.close()
    return _summarize(samples)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--email", default="dispatcher@metroflow.local")
    parser.add_argument("--password", default="metroflow-dev")
    args = parser.parse_args()

    token = _post(
        args.base_url, "/api/v1/auth/login", {"email": args.email, "password": args.password}
    )["access_token"]

    print("NFR-001 /api/v1/network/state (budget 500ms p95):")
    print(" ", bench_endpoint(args.base_url, "/api/v1/network/state", token))

    print("NFR-002 /api/v1/routing/navigate (budget 200ms p95):")
    print(
        " ",
        bench_endpoint(
            args.base_url, "/api/v1/routing/navigate?start_node=1&target_node=100", token
        ),
    )

    print("NFR-019 publish-to-SSE-delivery, server side (budget 100ms p95):")
    print(" ", bench_sse_delivery(args.base_url, token))


if __name__ == "__main__":
    main()
