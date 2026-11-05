"""
Empirical benchmark for every algorithm inventoried in the Milestone 1 proposal.

Run from backend/:  python -m benchmarks.bench_algorithms [--json out.json]

Each case reports the median and p95 of repeated timings, plus the growth ratio
between input sizes so the measured scaling can be compared with the derived
Big-O. The database-bound algorithms (rate limiter, SSE replay, ST_DWithin,
ST_Intersects, advisory upsert) run only when --db-url (or BENCH_DATABASE_URL)
points at a THROWAWAY PostGIS: the harness creates every table in it.
"""

import argparse
import heapq
import json
import math
import os
import random
import statistics
import struct
import time
import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace

import audit
import auth_utils
import events
import flood_state
import hydrology
import main as app_main
import models
import network_seed
import rate_limit
import reports
import routing

random.seed(20261104)


def timeit(fn, repeat: int = 7) -> dict:
    """Median and p95 wall time of ``fn`` in milliseconds."""
    samples = []
    for _ in range(repeat):
        start = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - start) * 1000.0)
    samples.sort()
    return {
        "median_ms": round(statistics.median(samples), 3),
        "p95_ms": round(samples[min(len(samples) - 1, int(0.95 * len(samples)))], 3),
    }


# --------------------------------------------------------------------------- #
# 1. A* vs Dijkstra on a synthetic city grid
# --------------------------------------------------------------------------- #


def grid_graph(side: int):
    """side x side lattice, bidirectional edges, random speed and depth."""
    nodes, edges = {}, {}
    lat0, lon0, step = 14.50, 121.00, 0.0009  # ~100 m blocks around Metro Manila
    for r in range(side):
        for c in range(side):
            nodes[r * side + c] = (lat0 + r * step, lon0 + c * step)
    for r in range(side):
        for c in range(side):
            u = r * side + c
            edges[u] = []
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                rr, cc = r + dr, c + dc
                if 0 <= rr < side and 0 <= cc < side:
                    edges[u].append(
                        (
                            rr * side + cc,
                            100.0,
                            random.choice((30, 40, 50, 60)),
                            random.choice((0, 0, 0, 5, 10, 15, 20, 26, 40)),
                        )
                    )
    return nodes, edges


def dijkstra_reference(edges, start, target, clearance):
    """Same edge cost as the engine, no heuristic. Used as the optimality oracle."""
    dist = {start: 0.0}
    pq = [(0.0, start)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, math.inf):
            continue
        if u == target:
            return d
        for v, length, speed, depth in edges.get(u, []):
            if depth >= clearance:
                continue
            pen = 1.0 + math.pow(depth / 10.0, 1.8)
            nd = d + length / max((speed / 3.6) / pen, 0.5)
            if nd < dist.get(v, math.inf):
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return math.inf


def settled_counts(nodes, edges, start, target, clearance):
    """Nodes settled by A* (engine's heuristic) and by Dijkstra (h = 0), same edge cost."""
    vmax = max(max(s for _, _, s, _ in adj) for adj in edges.values() if adj) / 3.6
    tgt = nodes[target]

    def run(use_h):
        h = (lambda x: routing_haversine(nodes[x], tgt) / vmax) if use_h else (lambda x: 0.0)
        g = {start: 0.0}
        settled = set()
        pq = [(h(start), 0.0, start)]
        while pq:
            _, gu, u = heapq.heappop(pq)
            if u in settled or gu > g.get(u, math.inf):
                continue
            settled.add(u)
            if u == target:
                break
            for v, length, speed, depth in edges[u]:
                if depth >= clearance:
                    continue
                pen = 1.0 + math.pow(depth / 10.0, 1.8)
                ng = gu + length / max((speed / 3.6) / pen, 0.5)
                if ng < g.get(v, math.inf):
                    g[v] = ng
                    heapq.heappush(pq, (ng + h(v), ng, v))
        return len(settled)

    return run(True), run(False)


def routing_haversine(a, b):
    return reports.haversine_m(a[0], a[1], b[0], b[1])


def bench_astar():
    out = {}
    for side in (32, 71, 141):  # about 1,000 / 5,000 / 20,000 nodes
        nodes, edges = grid_graph(side)
        n = len(nodes)
        m = sum(len(v) for v in edges.values())
        pairs = [(random.randrange(n), random.randrange(n)) for _ in range(40)]
        mismatches = 0
        astar_ms, dijk_ms = [], []
        for s, t in pairs:
            a0 = time.perf_counter()
            _, cost = routing.td_a_star_search(nodes, edges, s, t, 28.0)
            astar_ms.append((time.perf_counter() - a0) * 1000.0)
            d0 = time.perf_counter()
            ref = dijkstra_reference(edges, s, t, 28.0)
            dijk_ms.append((time.perf_counter() - d0) * 1000.0)
            if not (math.isclose(cost, ref, rel_tol=1e-9) or (cost == ref == math.inf)):
                mismatches += 1
        counts = [settled_counts(nodes, edges, s, t, 28.0) for s, t in pairs]
        astar_ms.sort()
        dijk_ms.sort()
        out[str(n)] = {
            "nodes": n,
            "edges": m,
            "queries": len(pairs),
            "astar_median_ms": round(statistics.median(astar_ms), 2),
            "astar_p95_ms": round(astar_ms[int(0.95 * len(astar_ms))], 2),
            "dijkstra_median_ms": round(statistics.median(dijk_ms), 2),
            "dijkstra_p95_ms": round(dijk_ms[int(0.95 * len(dijk_ms))], 2),
            "cost_mismatches_vs_dijkstra": mismatches,
            "mean_settled_astar": round(statistics.mean(a for a, _ in counts), 1),
            "mean_settled_dijkstra": round(statistics.mean(d for _, d in counts), 1),
            "queries_where_astar_settles_more": sum(1 for a, d in counts if a > d),
        }
    return out


# --------------------------------------------------------------------------- #
# 2. Hydrology (SCS-CN + ponding) over n nodes
# --------------------------------------------------------------------------- #


def bench_hydrology():
    out = {}
    for n in (10_000, 100_000):
        rain = [random.uniform(0, 80) for _ in range(n)]
        elev = [random.uniform(0, 12) for _ in range(n)]

        def run(rain=rain, elev=elev):
            for r, e in zip(rain, elev, strict=True):
                hydrology.compute_node_water_depth(hydrology.calculate_scs_cn_runoff(r), 1.0, e)

        out[str(n)] = timeit(run, 5)
    return out


# --------------------------------------------------------------------------- #
# 3. Report urgency: score + decay + sort
# --------------------------------------------------------------------------- #


def bench_urgency():
    out = {}
    now = datetime(2026, 11, 4, 12, 0, 0)
    for k in (10_000, 100_000):
        rows = [
            (
                random.choice(reports.DEPTH_LEVELS),
                random.choice(reports.SOURCES),
                random.randrange(0, 9),
                now - timedelta(minutes=random.uniform(0, 600)),
            )
            for _ in range(k)
        ]

        def run(rows=rows):
            scored = [
                reports.live_urgency(reports.base_urgency(d, s, c), t, now) for d, s, c, t in rows
            ]
            scored.sort(reverse=True)

        out[str(k)] = timeit(run, 5)
    return out


# --------------------------------------------------------------------------- #
# 4. Audit hash chain: append (digest) and verify
# --------------------------------------------------------------------------- #


def build_chain(length: int):
    chain, prev = [], None
    base = datetime(2026, 11, 4, 8, 0, 0)
    for i in range(length):
        payload = {"i": i, "note": "x" * 40}
        created = base + timedelta(seconds=i)
        h = audit.digest(
            user_id=1,
            action_type="HAZARD_CREATE",
            payload=payload,
            created_at=created,
            previous_hash=prev,
        )
        import json as _json

        chain.append(
            SimpleNamespace(
                log_id=i + 1,
                user_id=1,
                action_type="HAZARD_CREATE",
                payload=_json.dumps(payload, sort_keys=True, separators=(",", ":")),
                created_at=created,
                hash_signature=h,
            )
        )
        prev = h
    return chain


def bench_audit():
    out = {}
    for length in (1_000, 10_000, 100_000):
        chain = build_chain(length)
        out[str(length)] = timeit(lambda chain=chain: audit.verify_chain(chain), 3)
        assert audit.verify_chain(chain)["valid"]
    tampered = build_chain(1_000)
    tampered[500].payload = tampered[500].payload.replace("x", "y", 1)
    out["tamper_detected_at"] = audit.verify_chain(tampered)["broken_at"]
    return out


# --------------------------------------------------------------------------- #
# 5. Turn-by-turn instruction generation over a path of k nodes
# --------------------------------------------------------------------------- #


def bench_turns():
    out = {}
    for k in (100, 1_000, 10_000):
        coords = {i: (14.5 + 0.0003 * i, 121.0 + 0.0004 * math.sin(i / 5.0)) for i in range(k)}
        path = list(range(k))
        hops = [(i, i + 1, 40.0, f"Road {i // 20}") for i in range(k - 1)]
        names = {i: f"N{i}" for i in range(k)}
        out[str(k)] = timeit(
            lambda path=path, hops=hops, coords=coords, names=names: routing.build_instructions(
                path, hops, coords, names
            ),
            5,
        )
    return out


# --------------------------------------------------------------------------- #
# 6. Haversine, sensor mismatch, evidence checks, JWT, SSE frame, seed builder
# --------------------------------------------------------------------------- #


def bench_small():
    out = {}
    out["haversine_1e6_calls"] = timeit(
        lambda: [reports.haversine_m(14.55, 121.05, 14.56, 121.06) for _ in range(1_000_000)], 3
    )

    for g in (10, 100, 1_000):
        gauges = [
            (
                14.4 + random.random() * 0.4,
                120.9 + random.random() * 0.3,
                True,
                random.random() < 0.3,
            )
            for _ in range(g)
        ]
        out[f"sensor_mismatch_g{g}_x1000"] = timeit(
            lambda gauges=gauges: [
                reports.sensor_mismatch(14.6, 121.0, gauges) for _ in range(1_000)
            ],
            5,
        )

    for size_mb in (1, 5):
        blob = b"\xff\xd8\xff\xe0" + random.randbytes(size_mb * 1024 * 1024)
        out[f"photo_digest_{size_mb}MB"] = timeit(lambda blob=blob: reports.photo_digest(blob), 5)
        out[f"sniff+exif_{size_mb}MB_no_exif"] = timeit(
            lambda blob=blob: (reports.sniff_image_mime(blob), reports.read_exif(blob)), 5
        )

    token = auth_utils.create_access_token({"sub": "bench@example.com"})
    out["jwt_sign_x1000"] = timeit(
        lambda: [
            auth_utils.create_access_token({"sub": "bench@example.com"}) for _ in range(1_000)
        ],
        3,
    )
    out["jwt_verify_x1000"] = timeit(
        lambda: [
            auth_utils.jwt.decode(token, auth_utils.SECRET_KEY, algorithms=[auth_utils.ALGORITHM])
            for _ in range(1_000)
        ],
        3,
    )

    payload = {
        "id": 1,
        "status": "ACTIVE",
        "geometry": {"type": "Point", "coordinates": [121.0, 14.5]},
    }
    out["sse_frame_x100000"] = timeit(
        lambda: [events.frame(i, "hazard", payload) for i in range(100_000)], 3
    )

    out["seed_build_network"] = timeit(network_seed.build_network, 5)
    nodes, edges = network_seed.build_network()
    out["seed_graph_size"] = {"nodes": len(nodes), "edges": len(edges)}
    return out


# --------------------------------------------------------------------------- #
# 7. Remaining in-process algorithms
# --------------------------------------------------------------------------- #


def build_exif_jpeg(body_bytes: int = 0) -> bytes:
    """Minimal little-endian JPEG carrying Make, DateTimeOriginal and GPS tags."""

    def entry(tag, kind, count, value):
        return struct.pack("<HHII", tag, kind, count, value)

    make = b"MetroCam\x00"
    when = b"2026:11:03 14:05:09\x00"
    ifd0_at, make_at = 8, 50
    exif_at = make_at + 10
    when_at = exif_at + 2 + 12 + 4
    gps_at = when_at + len(when)
    lat_at, lon_at = gps_at + 2 + 4 * 12 + 4, gps_at + 2 + 4 * 12 + 4 + 24

    ifd0 = (
        struct.pack("<H", 3)
        + entry(0x010F, 2, len(make), make_at)
        + entry(0x8769, 4, 1, exif_at)
        + entry(0x8825, 4, 1, gps_at)
        + struct.pack("<I", 0)
    )
    exif = struct.pack("<H", 1) + entry(0x9003, 2, len(when), when_at) + struct.pack("<I", 0)
    gps = (
        struct.pack("<H", 4)
        + entry(1, 2, 2, int.from_bytes(b"N\x00\x00\x00", "little"))
        + entry(2, 5, 3, lat_at)
        + entry(3, 2, 2, int.from_bytes(b"E\x00\x00\x00", "little"))
        + entry(4, 5, 3, lon_at)
        + struct.pack("<I", 0)
    )

    def rationals(d, m, s):
        return struct.pack("<6I", d, 1, m, 1, s, 1)

    tiff = (
        b"II"
        + struct.pack("<HI", 42, ifd0_at)
        + ifd0
        + make.ljust(10, b"\x00")
        + exif
        + when
        + gps
        + rationals(14, 33, 0)
        + rationals(121, 3, 0)
    )
    app1 = b"Exif\x00\x00" + tiff
    return (
        b"\xff\xd8\xff\xe1"
        + struct.pack(">H", len(app1) + 2)
        + app1
        + b"\xff\xda"
        + random.randbytes(body_bytes)
    )


def bench_extra_pure():
    out = {}
    out["classify_passability+hazard_blocks_1e6"] = timeit(
        lambda: [
            (routing.classify_passability(d % 60, 28.0), routing.hazard_blocks("LEVEL_2"))
            for d in range(1_000_000)
        ],
        3,
    )

    now = datetime(2026, 11, 4, 12, 0, 0)
    for m in (10_000, 100_000):
        inputs = []
        for i in range(m):
            obs = tuple(
                flood_state.Observation(
                    f"SENSOR:S{j}",
                    random.choice(("OBSERVED", "MODELLED", "SIMULATED")),
                    now - timedelta(minutes=random.uniform(0, 90)),
                    random.random() < 0.4,
                )
                for j in range(random.randrange(0, 4))
            )
            inputs.append(
                flood_state.EdgeInputs(
                    i,
                    "LEVEL_2" if random.random() < 0.05 else None,
                    random.random() < 0.5,
                    obs,
                    random.choice((None, None, "LOW", "MEDIUM", "HIGH")),
                )
            )
        out[f"flood_state_resolve_{m}_edges"] = timeit(
            lambda inputs=inputs: [flood_state.resolve(e, now=now, raining=True) for e in inputs], 5
        )

    for n in (10_000, 100_000):
        nodes = {
            i: SimpleNamespace(
                latitude=14.4 + random.random() * 0.4, longitude=120.9 + random.random() * 0.3
            )
            for i in range(n)
        }
        out[f"nearest_node_{n}_x10"] = timeit(
            lambda nodes=nodes: [app_main._nearest_node(nodes, 14.6, 121.0) for _ in range(10)], 5
        )

    for k in (200, 800, 3_200):
        rows = [
            (
                SimpleNamespace(
                    report_id=uuid.uuid4(),
                    status=reports.WAITING,
                    submitted_at=now - timedelta(minutes=random.uniform(0, 15)),
                ),
                14.55 + random.random() * 0.02,
                121.0 + random.random() * 0.02,
                None,
            )
            for _ in range(k)
        ]
        out[f"neighbour_map_{k}_reports"] = timeit(
            lambda rows=rows: app_main._neighbour_map(rows, now), 3
        )

    out["hazard_polygon+plausible_1e5"] = timeit(
        lambda: [
            (reports.hazard_polygon(14.55, 121.0), reports.location_plausible(14.55, 121.0))
            for _ in range(100_000)
        ],
        3,
    )
    out["reporter_hash_1e5"] = timeit(
        lambda: [reports.reporter_hash(i, "salt") for i in range(100_000)], 3
    )

    for body_mb in (0, 1, 5):
        blob = build_exif_jpeg(body_mb * 1024 * 1024)
        parsed = reports.read_exif(blob)
        assert parsed.get("captured_at") == "2026:11:03 14:05:09" and parsed.get(
            "gps_in_pilot_area"
        ), parsed
        out[f"read_exif_real_{body_mb}MB_image"] = timeit(
            lambda blob=blob: reports.read_exif(blob), 7
        )
    out["read_exif_truncated_returns_empty"] = reports.read_exif(build_exif_jpeg()[:60]) == {}

    nodes, edges = grid_graph(71)
    pairs = [(random.randrange(len(nodes)), random.randrange(len(nodes))) for _ in range(10)]
    out["dispatch_preview_K10_N5041"] = timeit(
        lambda: [routing.td_a_star_search(nodes, edges, 0, t, 28.0) for _, t in pairs], 5
    )
    return out


# --------------------------------------------------------------------------- #
# 8. Database-bound algorithms (throwaway PostGIS only)
# --------------------------------------------------------------------------- #


def bench_db(url):
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    models.Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    # JIT compiles for ~1 s on the 1M-cost plan and would swamp the 100 ms signal.
    session.execute(text("SET jit = off"))
    out = {}

    def run(sql, **params):
        session.execute(text(sql), params)
        session.commit()

    # Rate limiter: one atomic upsert per request.
    samples = []
    for _ in range(300):
        t0 = time.perf_counter()
        rate_limit.consume(session, "bench:1.2.3.4", 60)
        samples.append((time.perf_counter() - t0) * 1000.0)
    samples.sort()
    out["rate_limit_consume_per_call_ms"] = {
        "median_ms": round(statistics.median(samples), 3),
        "p95_ms": round(samples[int(0.95 * len(samples))], 3),
    }

    # SSE replay: indexed tail read, growing log.
    out["sse_replay"] = {}
    for total in (10_000, 100_000, 500_000):
        run("TRUNCATE event_log RESTART IDENTITY")
        run(
            "INSERT INTO event_log (channel, event_type, payload, created_at) "
            "SELECT 'hazard', 'hazard.published', '{}'::jsonb, now() FROM generate_series(1, :n)",
            n=total,
        )
        run("ANALYZE event_log")
        out["sse_replay"][str(total)] = {
            "tail_100_events": timeit(
                lambda total=total: events.replay(session, "hazard", total - 100, 100), 15
            ),
            "head_100_events": timeit(lambda: events.replay(session, "hazard", 0, 100), 15),
        }

    # Spatial: sensor impact radius (the app's geography-cast query), hazard coverage, advisory upsert.
    from geoalchemy2 import Geography
    from sqlalchemy import cast, func

    geog = Geography(srid=4326)
    out["st_dwithin_impact_radius"] = {}
    out["st_intersects_hazard_coverage"] = {}
    for total in (1_000, 10_000, 50_000):
        side = int(math.sqrt(total))
        for table in ("edge_advisories", "hazard_zones", "sensors", "road_edges", "road_nodes"):
            run(f"DELETE FROM {table}")
        run(
            "INSERT INTO road_nodes (node_id, latitude, longitude, elevation_m, geom) "
            "SELECT i, 14.4 + (i / :s) * 0.0009, 120.9 + (i % :s) * 0.0009, 5, "
            "ST_SetSRID(ST_MakePoint(120.9 + (i % :s) * 0.0009, 14.4 + (i / :s) * 0.0009), 4326) "
            "FROM generate_series(0, :n - 1) i",
            s=side,
            n=side * side,
        )
        run(
            "INSERT INTO road_edges (edge_id, start_node_id, end_node_id, distance_meters, max_speed_kmh, lanes, geom) "
            "SELECT a.node_id + 1, a.node_id, b.node_id, 100, 50, 2, ST_MakeLine(a.geom, b.geom) "
            "FROM road_nodes a JOIN road_nodes b ON b.node_id = a.node_id + 1 AND a.node_id % :s < :s - 1",
            s=side,
        )
        centre_lat, centre_lon = 14.4 + (side // 2) * 0.0009, 120.9 + (side // 2) * 0.0009
        run(
            "INSERT INTO sensors (sensor_id, sensor_type, name, geom, threshold_value, threshold_unit, "
            "impact_radius_m, active, simulated) VALUES ('BENCH', 'RIVER_GAUGE', 'bench', "
            "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 1.0, 'm', 500, true, false)",
            lat=centre_lat,
            lon=centre_lon,
        )
        run("ANALYZE road_edges")

        def impact_query():
            return [
                r.edge_id
                for r in session.query(models.RoadEdge.edge_id)
                .join(models.Sensor, models.Sensor.sensor_id == "BENCH")
                .filter(
                    func.ST_DWithin(
                        cast(models.RoadEdge.geom, geog),
                        cast(models.Sensor.geom, geog),
                        models.Sensor.impact_radius_m,
                    )
                )
            ]

        edge_ids = impact_query()
        plan = "\n".join(
            r[0]
            for r in session.execute(
                text(
                    "EXPLAIN SELECT e.edge_id FROM road_edges e JOIN sensors s ON s.sensor_id='BENCH' "
                    "WHERE ST_DWithin(e.geom::geography, s.geom::geography, s.impact_radius_m)"
                )
            )
        )
        entry = {
            "edges": total,
            "edges_returned": len(edge_ids),
            "app_query": timeit(impact_query, 5),
            "app_query_is_seq_scan_on_edges": "Seq Scan on road_edges" in plan,
        }
        run(
            "CREATE INDEX IF NOT EXISTS ix_bench_edges_geog ON road_edges USING gist ((geom::geography))"
        )
        run("ANALYZE road_edges")
        entry["with_geography_gist_index"] = timeit(impact_query, 5)
        run("DROP INDEX IF EXISTS ix_bench_edges_geog")
        out["st_dwithin_impact_radius"][str(total)] = entry

        # Advisory upsert for the edges the query returned.
        out.setdefault("advisory_upsert", {})[str(total)] = timeit(
            lambda edge_ids=edge_ids: (
                app_main._upsert_advisories(
                    session,
                    edge_ids,
                    source="SENSOR:BENCH",
                    kind="OBSERVED",
                    flagged=True,
                    as_of=datetime(2026, 11, 4, 12, 0, 0),
                ),
                session.commit(),
            ),
            7,
        )

        # Hazard coverage: 20 small polygons over the edge set, the app's own loader.
        run(
            "INSERT INTO hazard_zones (name, obstruction_level, avg_depth_cm, geometry, active) "
            "SELECT 'bench ' || g, 'LEVEL_2', 40, (ST_Buffer(ST_SetSRID(ST_MakePoint("
            "120.9 + (g * 7 % :s) * 0.0009, 14.4 + (g * 3 % :s) * 0.0009), 4326), 0.0004))::geometry, true "
            "FROM generate_series(1, 20) g",
            s=side,
        )
        out["st_intersects_hazard_coverage"][str(total)] = {
            "edges": total,
            **timeit(lambda: app_main._load_hazard_coverage(session), 5),
        }
        session.rollback()
    session.close()
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", help="write results to this file")
    parser.add_argument(
        "--db-url",
        default=os.getenv("BENCH_DATABASE_URL"),
        help="THROWAWAY PostGIS url; omit to skip database-bound cases",
    )
    args = parser.parse_args()

    results = {
        "astar_vs_dijkstra": bench_astar(),
        "hydrology_scs_cn_ponding": bench_hydrology(),
        "report_urgency_score_and_sort": bench_urgency(),
        "audit_chain_verify": bench_audit(),
        "turn_by_turn": bench_turns(),
        "small_algorithms": bench_small(),
        "extra_in_process": bench_extra_pure(),
    }
    if args.db_url:
        results["database_bound"] = bench_db(args.db_url)
    text = json.dumps(results, indent=2)
    print(text)
    if args.json:
        with open(args.json, "w") as handle:
            handle.write(text)


if __name__ == "__main__":
    main()
