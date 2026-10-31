"""
API contract tests against a real PostGIS + Redis stack.

These are excluded from the default run (see pytest.ini) because they need a
live database. Run them with:

    pytest -m integration

In CI they run against the postgis/postgis service container declared in
.github/workflows/backend.yml.

The point of these tests is the *contract the map renderer consumes*: GeoJSON
shape, coordinate order, and the passability vocabulary. The unit tests in
test_routing.py / test_hydrology.py cover the algorithms; neither would catch a
[lat, lon] swap or a broken FeatureCollection.
"""

import json
from contextlib import contextmanager

import pytest
from evidence import build_jpeg
from fastapi.testclient import TestClient

from config import settings
from main import app
from network_seed import build_network

pytestmark = pytest.mark.integration

ALLOWED_STATUSES = {"PASSABLE", "LIGHT_FLOOD", "SUBMERGED"}

# The contract is "every seeded node and edge", not a literal count: the graph
# grew from the four-node demonstration spine to the curated corridor lattice
# (TSD LIM-014) and will keep changing. Read the expected size from the seed so
# this test fails on a broken response, not on a reseed.
SEED_NODES, SEED_EDGES = build_network()
NODE_COUNT = len(SEED_NODES)
EDGE_COUNT = len(SEED_EDGES)

# Metro Manila bounding box. Used to prove coordinates are [lon, lat]: a swap
# would put longitude at ~14 and latitude at ~121 and fail these bounds.
LON_RANGE = (120.9, 121.2)
LAT_RANGE = (14.4, 14.8)


@pytest.fixture(scope="session")
def client():
    """
    One app lifespan for the whole session, signed in as the bootstrap dispatcher.

    Startup runs seeding and geometry backfill, so re-entering it per test would
    repeat that DDL dozens of times for no benefit. Every /api/v1 route except
    the auth entry points now requires a token (TSD LIM-022), so the contract
    client signs in once and reuses the header.
    """
    from config import settings

    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/v1/auth/login",
            json={"email": settings.admin_email, "password": settings.admin_password},
        )
        assert response.status_code == 200, f"dispatcher sign-in failed: {response.text}"
        test_client.headers["Authorization"] = f"Bearer {response.json()['access_token']}"
        yield test_client


@pytest.fixture(autouse=True)
def dry_network(client):
    """Reset the network to dry before every test so cases stay independent."""
    client.post(
        "/api/v1/simulation/rain",
        params={"rainfall_mm_hr": 0, "clearance_cm": 30},
    )
    yield


def edge_features(response):
    return response.json()["edges"]["features"]


def status_map(response):
    return {
        feature["properties"]["edge_id"]: (
            feature["properties"]["water_depth_cm"],
            feature["properties"]["status"],
        )
        for feature in edge_features(response)
    }


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------


def test_security_headers_are_present_on_every_response(client):
    """
    Regression guard for the OWASP ZAP findings.

    ZAP flagged "X-Content-Type-Options Header Missing" and "Cross-Origin-
    Resource-Policy Header Missing or Invalid" on every endpoint. These headers
    come from middleware, so checking one route covers the rest -- but the
    middleware must also survive the CORS layer, which is why this goes through
    the real app rather than a hand-built response.
    """
    response = client.get("/")
    assert response.status_code == 200

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cross-origin-resource-policy"] == "cross-origin"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["x-frame-options"] == "DENY"


# ---------------------------------------------------------------------------
# Route-level authentication (TSD LIM-022)
# ---------------------------------------------------------------------------


def test_reads_and_writes_are_rejected_without_a_token(client):
    """The bearer header is what separates an anonymous caller from a write."""
    token = client.headers.pop("Authorization")
    try:
        read = client.get("/api/v1/network/state", params={"clearance_cm": 30})
        write = client.post(
            "/api/v1/simulation/rain",
            params={"rainfall_mm_hr": 10, "clearance_cm": 30},
        )
    finally:
        client.headers["Authorization"] = token

    assert read.status_code == 401
    assert write.status_code == 401


def test_a_garbage_token_is_rejected(client):
    token = client.headers.pop("Authorization")
    try:
        response = client.get(
            "/api/v1/network/state",
            params={"clearance_cm": 30},
            headers={"Authorization": "Bearer not-a-token"},
        )
    finally:
        client.headers["Authorization"] = token

    assert response.status_code == 401


# ---------------------------------------------------------------------------
# GeoJSON contract
# ---------------------------------------------------------------------------


def test_network_state_returns_renderable_geojson(client):
    response = client.get("/api/v1/network/state", params={"clearance_cm": 30})
    assert response.status_code == 200

    body = response.json()
    assert body["clearance_cm"] == 30.0
    assert body["edges"]["type"] == "FeatureCollection"
    assert body["nodes"]["type"] == "FeatureCollection"
    assert len(body["edges"]["features"]) == EDGE_COUNT
    assert len(body["nodes"]["features"]) == NODE_COUNT
    assert EDGE_COUNT > 4, "the pilot graph should be more than the demo spine"

    for feature in body["edges"]["features"]:
        assert feature["type"] == "Feature"
        assert feature["geometry"]["type"] == "LineString"
        coordinates = feature["geometry"]["coordinates"]
        assert len(coordinates) >= 2

        for longitude, latitude in coordinates:
            assert LON_RANGE[0] <= longitude <= LON_RANGE[1], f"bad longitude {longitude}"
            assert LAT_RANGE[0] <= latitude <= LAT_RANGE[1], f"bad latitude {latitude}"

        properties = feature["properties"]
        assert properties["status"] in ALLOWED_STATUSES
        assert properties["water_depth_cm"] >= 0
        assert properties["start_name"] and properties["end_name"]

    for feature in body["nodes"]["features"]:
        assert feature["geometry"]["type"] == "Point"
        longitude, latitude = feature["geometry"]["coordinates"]
        assert LON_RANGE[0] <= longitude <= LON_RANGE[1]
        assert LAT_RANGE[0] <= latitude <= LAT_RANGE[1]


def test_postgis_geometry_is_populated_with_srid_4326():
    from sqlalchemy import text

    from database import engine

    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT ST_SRID(geom), ST_IsValid(geom), ST_GeometryType(geom) FROM road_edges")
        ).all()

    assert rows, "no road edges found"
    assert all(srid == 4326 for srid, _, _ in rows)
    assert all(valid for _, valid, _ in rows)
    assert all(geometry_type == "ST_LineString" for _, _, geometry_type in rows)


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------


def test_heavy_rain_submerges_every_edge_for_a_sedan(client):
    response = client.post(
        "/api/v1/simulation/rain",
        params={"rainfall_mm_hr": 120, "clearance_cm": 20},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["affected_edges"] == EDGE_COUNT
    assert body["runoff_mm"] > 0
    assert {feature["properties"]["status"] for feature in body["edges"]["features"]} == {
        "SUBMERGED"
    }


def test_dry_simulation_clears_all_flooding(client):
    client.post(
        "/api/v1/simulation/rain",
        params={"rainfall_mm_hr": 120, "clearance_cm": 30},
    )
    response = client.post(
        "/api/v1/simulation/rain",
        params={"rainfall_mm_hr": 0, "clearance_cm": 30},
    )

    body = response.json()
    assert body["runoff_mm"] == 0.0
    assert {feature["properties"]["status"] for feature in body["edges"]["features"]} == {
        "PASSABLE"
    }
    assert all(
        feature["properties"]["water_depth_cm"] == 0 for feature in body["edges"]["features"]
    )


def test_simulation_response_matches_network_state(client):
    """The one-round-trip simulation payload must not drift from the read path."""
    post = client.post(
        "/api/v1/simulation/rain",
        params={"rainfall_mm_hr": 75, "clearance_cm": 35},
    )
    get = client.get("/api/v1/network/state", params={"clearance_cm": 35})

    assert status_map(post) == status_map(get)


def test_clearance_changes_status_without_re_simulating(client):
    client.post(
        "/api/v1/simulation/rain",
        params={"rainfall_mm_hr": 120, "clearance_cm": 30},
    )

    low_clearance = client.get("/api/v1/network/state", params={"clearance_cm": 20}).json()
    high_clearance = client.get("/api/v1/network/state", params={"clearance_cm": 60}).json()

    low_statuses = {f["properties"]["status"] for f in low_clearance["edges"]["features"]}
    high_statuses = {f["properties"]["status"] for f in high_clearance["edges"]["features"]}

    assert "SUBMERGED" in low_statuses
    assert "SUBMERGED" not in high_statuses

    # Depths are identical: only the derived status may change.
    assert {
        f["properties"]["edge_id"]: f["properties"]["water_depth_cm"]
        for f in low_clearance["edges"]["features"]
    } == {
        f["properties"]["edge_id"]: f["properties"]["water_depth_cm"]
        for f in high_clearance["edges"]["features"]
    }


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------


def test_route_returns_line_geometry_and_segments(client):
    client.post(
        "/api/v1/simulation/rain",
        params={"rainfall_mm_hr": 60, "clearance_cm": 35},
    )
    response = client.get(
        "/api/v1/routing/navigate",
        params={"start_node": 1, "target_node": 4, "clearance_cm": 35},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["geometry"]["type"] == "LineString"
    assert len(body["geometry"]["coordinates"]) >= 2
    assert body["optimal_path_nodes"][0] == 1
    assert body["optimal_path_nodes"][-1] == 4
    assert body["segments"], "route should report the edges it traverses"
    assert all(segment["status"] in ALLOWED_STATUSES for segment in body["segments"])
    assert body["estimated_travel_time_minutes"] > 0

    for longitude, latitude in body["geometry"]["coordinates"]:
        assert LON_RANGE[0] <= longitude <= LON_RANGE[1]
        assert LAT_RANGE[0] <= latitude <= LAT_RANGE[1]


def test_route_returns_404_when_every_edge_is_submerged(client):
    client.post(
        "/api/v1/simulation/rain",
        params={"rainfall_mm_hr": 120, "clearance_cm": 20},
    )
    response = client.get(
        "/api/v1/routing/navigate",
        params={"start_node": 1, "target_node": 4, "clearance_cm": 20},
    )

    assert response.status_code == 404
    assert "no safe route" in response.json()["detail"].lower()


def test_reverse_route_is_supported(client):
    """Regression: the seed graph is one-directional, the API graph is not."""
    response = client.get(
        "/api/v1/routing/navigate",
        params={"start_node": 4, "target_node": 1, "clearance_cm": 60},
    )
    assert response.status_code == 200
    assert response.json()["optimal_path_nodes"][0] == 4


def test_unknown_node_returns_404_with_available_nodes(client):
    response = client.get(
        "/api/v1/routing/navigate",
        params={"start_node": 99, "target_node": 4},
    )
    assert response.status_code == 404

    detail = response.json()["detail"]
    assert "99" in detail
    assert "Available nodes" in detail


@pytest.mark.parametrize("clearance", [0, -5, 500])
def test_invalid_clearance_is_rejected(client, clearance):
    response = client.get(
        "/api/v1/routing/navigate",
        params={"start_node": 1, "target_node": 4, "clearance_cm": clearance},
    )
    assert response.status_code == 422


@pytest.mark.parametrize("rainfall", [-1, 500])
def test_invalid_rainfall_is_rejected(client, rainfall):
    response = client.post(
        "/api/v1/simulation/rain",
        params={"rainfall_mm_hr": rainfall},
    )
    assert response.status_code == 422


def test_rate_limit_counter_round_trips_against_a_real_database():
    """The limiter's upsert is the one piece SQLite cannot vouch for.

    This also proves the migration that creates the table has been applied to
    whatever database the suite is pointed at, which is the failure a serverless
    deployment would otherwise only discover on the first 429.
    """
    from uuid import uuid4

    from sqlalchemy import text

    from database import SessionLocal
    from rate_limit import consume

    bucket = f"integration:{uuid4()}"
    with SessionLocal() as db:
        try:
            assert consume(db, bucket, 60)[0] == 1
            assert consume(db, bucket, 60)[0] == 2
        finally:
            db.execute(
                text("DELETE FROM rate_limit_counters WHERE bucket = :bucket"), {"bucket": bucket}
            )
            db.commit()


# ---------------------------------------------------------------------------
# Audit trail (FSD-FR-093, TC-044)
# ---------------------------------------------------------------------------


def latest_audit(client, **params):
    response = client.get("/api/v1/audit", params={"limit": 200, **params})
    assert response.status_code == 200
    return response.json()


def test_each_privileged_action_writes_one_attributable_audit_row(client):
    """TC-044: one row per action, naming the actor, with the payload."""
    hazard = client.post(
        "/api/v1/hazards",
        json={"name": "Audit probe", "obstruction_level": "CAUTION", "avg_depth_cm": 20},
    ).json()
    client.post(f"/api/v1/hazards/{hazard['hazard_id']}/publish")

    created = latest_audit(client, action_type="HAZARD_CREATE")[0]
    published = latest_audit(client, action_type="HAZARD_PUBLISH")[0]

    assert created["user_id"] is not None
    assert created["payload"]["hazard_id"] == hazard["hazard_id"]
    assert len(created["hash_signature"]) == 64

    assert published["payload"]["hazard_id"] == hazard["hazard_id"]
    # The chain is ordered: the publish was recorded after the create.
    assert published["log_id"] > created["log_id"]


def test_simulation_is_audited_with_its_inputs(client):
    client.post("/api/v1/simulation/rain", params={"rainfall_mm_hr": 40, "clearance_cm": 30})

    entry = latest_audit(client, action_type="SIMULATION_RAIN")[0]
    assert entry["payload"]["rainfall_mm_hr"] == 40.0
    assert entry["payload"]["affected_edges"] == EDGE_COUNT


def test_audit_chain_verifies(client):
    result = client.get("/api/v1/audit/verify")
    assert result.status_code == 200

    body = result.json()
    assert body["valid"] is True, f"chain broken at log {body['broken_at']}"
    assert body["checked"] >= 1


# ---------------------------------------------------------------------------
# Field reports and moderation (FSD-FR-065 to 067, 077 to 081)
# ---------------------------------------------------------------------------


@pytest.fixture
def created_records():
    """Delete the reports and hazards a test created, leaving the audit chain alone.

    Audit rows are append-only by design, so they stay: deleting one would break
    every later link in the chain the next test verifies.
    """
    from sqlalchemy import text

    from database import SessionLocal

    report_ids: list[str] = []
    hazard_ids: list[int] = []
    yield report_ids, hazard_ids

    with SessionLocal() as db:
        if report_ids:
            db.execute(
                text(
                    "UPDATE incident_reports SET duplicate_of = NULL WHERE report_id::text = ANY(:ids)"
                ),
                {"ids": report_ids},
            )
            db.execute(
                text("DELETE FROM incident_reports WHERE report_id::text = ANY(:ids)"),
                {"ids": report_ids},
            )
        if hazard_ids:
            db.execute(
                text("DELETE FROM hazard_zones WHERE hazard_id = ANY(:ids)"),
                {"ids": hazard_ids},
            )
        db.commit()


def submit_report(
    client, created_records, *, depth="KNEE", latitude=14.5764, longitude=121.0851, **extra
):
    """Post a report with photo evidence and return the response body."""
    report_ids, _ = created_records
    data = {
        "depth_level": depth,
        "latitude": str(latitude),
        "longitude": str(longitude),
        **{key: str(value) for key, value in extra.items()},
    }
    response = client.post(
        "/api/v1/reports",
        data=data,
        files={"photo": ("evidence.jpg", build_jpeg(), "image/jpeg")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    report_ids.append(body["report_id"])
    return body


def test_report_submission_enters_the_queue_with_evidence_metadata(client, created_records):
    photo = build_jpeg()
    response = client.post(
        "/api/v1/reports",
        data={
            "depth_level": "KNEE",
            "latitude": "14.5764",
            "longitude": "121.0851",
            "barangay": "San Antonio",
            "narrative": "Knee-deep outside the barangay hall",
        },
        files={"photo": ("evidence.jpg", photo, "image/jpeg")},
    )
    assert response.status_code == 201, response.text
    created_records[0].append(response.json()["report_id"])
    body = response.json()

    assert body["status"] == "PENDING"
    assert body["source"] == "PHOTO"
    assert body["depth_label"] == "Knee-Deep"
    assert body["barangay"] == "San Antonio"
    assert body["urgency_score"] > 0
    assert body["location_plausible"] is True
    assert len(body["reporter_hash"]) == 64
    assert body["photo"]["bytes"] == len(photo)
    assert body["photo"]["mime"] == "image/jpeg"
    assert body["photo"]["sha256"] == __import__("hashlib").sha256(photo).hexdigest()
    # The capture time comes from the camera's EXIF when the client sends none.
    assert body["captured_at"].startswith("2026-10-29T13:00:00")
    assert body["exif"]["camera_make"] == "TestCam"


def test_the_queue_is_ordered_by_live_urgency(client, created_records):
    ankle = submit_report(client, created_records, depth="ANKLE")
    impassable = submit_report(
        client, created_records, depth="IMPASSABLE", latitude=14.58, longitude=121.09
    )

    response = client.get("/api/v1/reports", params={"limit": 200})
    assert response.status_code == 200
    ordered = [row["report_id"] for row in response.json()]

    assert ordered.index(impassable["report_id"]) < ordered.index(ankle["report_id"])


def test_evidence_photo_round_trips(client, created_records):
    photo = build_jpeg()
    report = submit_report(client, created_records)
    original = client.post(
        "/api/v1/reports",
        data={"depth_level": "KNEE", "latitude": "14.5764", "longitude": "121.0851"},
        files={"photo": ("evidence.jpg", photo, "image/jpeg")},
    )
    created_records[0].append(original.json()["report_id"])

    response = client.get(f"/api/v1/reports/{original.json()['report_id']}/photo")
    assert response.status_code == 200
    assert response.content == photo
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"] == "private, no-store"
    assert report["photo"] is not None


def test_nearby_reports_are_flagged_as_possible_duplicates_but_kept(client, created_records):
    first = submit_report(client, created_records)
    second = submit_report(client, created_records, narrative="Same flood, reported again")

    assert second["status"] == "PENDING"
    assert second["nearby_reports"] >= 1
    assert second["possible_duplicate_of"] == first["report_id"]


def test_approving_a_report_creates_and_publishes_a_hazard(client, created_records):
    report = submit_report(client, created_records, depth="KNEE", barangay="San Antonio")

    response = client.post(f"/api/v1/reports/{report['report_id']}/approve", json={})
    assert response.status_code == 200, response.text
    body = response.json()
    created_records[1].append(body["hazard_id"])

    assert body["status"] == "VERIFIED"
    assert body["hazard_id"] is not None
    assert body["moderated_by"] is not None
    assert body["moderated_at"] is not None

    active = client.get("/api/v1/hazards/active")
    assert active.status_code == 200
    hazard = next(row for row in active.json() if row["hazard_id"] == body["hazard_id"])
    assert hazard["obstruction_level"] == "LEVEL_2"
    assert hazard["avg_depth_cm"] == 50
    assert hazard["active"] is True
    assert hazard["published_at"] is not None

    # A verified report leaves the pending queue.
    queue = client.get("/api/v1/reports", params={"status": "PENDING", "limit": 200}).json()
    assert body["report_id"] not in [row["report_id"] for row in queue]

    audit_entry = client.get("/api/v1/audit", params={"action_type": "REPORT_APPROVE"}).json()[0]
    assert audit_entry["payload"]["report_id"] == report["report_id"]
    assert audit_entry["payload"]["hazard_id"] == body["hazard_id"]


def test_rejection_requires_a_reason(client, created_records):
    report = submit_report(client, created_records)

    assert client.post(f"/api/v1/reports/{report['report_id']}/reject", json={}).status_code == 422
    assert (
        client.post(
            f"/api/v1/reports/{report['report_id']}/reject", json={"reason": "no"}
        ).status_code
        == 422
    )


def test_reject_and_mark_duplicate_keep_the_evidence_and_the_reason(client, created_records):
    first = submit_report(client, created_records)
    second = submit_report(client, created_records)

    rejected = client.post(
        f"/api/v1/reports/{first['report_id']}/reject",
        json={"reason": "Photo shows a dry road"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "REJECTED"
    assert rejected.json()["decision_reason"] == "Photo shows a dry road"

    duplicate = client.post(
        f"/api/v1/reports/{second['report_id']}/reject",
        json={"reason": "Same flood as the earlier report", "duplicate_of": first["report_id"]},
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["status"] == "DUPLICATE"
    assert duplicate.json()["duplicate_of"] == first["report_id"]

    # Both decisions are audited with their reason.
    entries = client.get(
        "/api/v1/audit", params={"action_type": "REPORT_REJECT", "limit": 200}
    ).json()
    payloads = [entry["payload"] for entry in entries]
    assert any(row["status"] == "REJECTED" for row in payloads)
    assert any(row["status"] == "DUPLICATE" for row in payloads)


def test_a_decided_report_cannot_be_moderated_again(client, created_records):
    report = submit_report(client, created_records)
    client.post(f"/api/v1/reports/{report['report_id']}/reject", json={"reason": "Not a road"})

    again = client.post(f"/api/v1/reports/{report['report_id']}/approve", json={})
    assert again.status_code == 409


def test_unknown_reports_are_not_found(client):
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"/api/v1/reports/{missing}").status_code == 404
    assert client.get(f"/api/v1/reports/{missing}/photo").status_code == 404
    assert client.post(f"/api/v1/reports/{missing}/approve", json={}).status_code == 404
    assert (
        client.post(f"/api/v1/reports/{missing}/reject", json={"reason": "gone"}).status_code == 404
    )


def test_non_image_evidence_is_rejected(client):
    response = client.post(
        "/api/v1/reports",
        data={"depth_level": "ANKLE", "latitude": "14.5764", "longitude": "121.0851"},
        files={"photo": ("evidence.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 415


def test_evidence_over_the_ceiling_is_rejected(client):
    from config import settings

    oversized = b"\xff\xd8" + b"0" * settings.report_photo_max_bytes
    response = client.post(
        "/api/v1/reports",
        data={"depth_level": "ANKLE", "latitude": "14.5764", "longitude": "121.0851"},
        files={"photo": ("evidence.jpg", oversized, "image/jpeg")},
    )
    assert response.status_code == 413


def test_unknown_depth_or_source_is_rejected(client):
    too_deep = client.post(
        "/api/v1/reports",
        data={"depth_level": "WAIST", "latitude": "14.5764", "longitude": "121.0851"},
    )
    unknown_source = client.post(
        "/api/v1/reports",
        data={
            "depth_level": "ANKLE",
            "latitude": "14.5764",
            "longitude": "121.0851",
            "source": "TELEPATHY",
        },
    )
    assert too_deep.status_code == 422
    assert unknown_source.status_code == 422


def test_a_lying_content_type_does_not_get_an_image_through(client):
    response = client.post(
        "/api/v1/reports",
        data={"depth_level": "ANKLE", "latitude": "14.5764", "longitude": "121.0851"},
        files={"photo": ("evidence.jpg", b"GIF89a-not-really", "image/jpeg")},
    )
    assert response.status_code == 415


# ---------------------------------------------------------------------------
# Event streams (FSD-FR-086, ADR-024)
# ---------------------------------------------------------------------------
#
# Two things are worth pinning against a real database: the snapshot and the
# tail read the same committed rows, and a mutation's event is visible to a
# subscriber that starts after it. The framing and cursor rules are unit-tested
# without a database; these tests prove the wiring.


def _sse_frames(lines):
    """Parse SSE field lines into the events they describe, dropping comments."""
    event_id = None
    event_type = None
    data: list[str] = []

    for raw in lines:
        line = raw.rstrip("\r")
        if not line:
            if data:
                yield {
                    "id": event_id,
                    "event": event_type,
                    "data": json.loads("\n".join(data)),
                }
            event_id = event_type = None
            data = []
            continue
        if line.startswith(":"):
            # Keep-alive comment; the client only needs the socket open.
            continue
        field, _, value = line.partition(":")
        value = value.removeprefix(" ")
        if field == "id":
            event_id = int(value)
        elif field == "event":
            event_type = value
        elif field == "data":
            data.append(value)


@contextmanager
def sse(client, monkeypatch, path, *, lifetime=1.0, params=None, headers=None):
    """Open a stream that ends by itself shortly after the test reads what it needs.

    The real relay lives 45 s, which is far too long to wait in a test and would
    leave the ASGI transport reading an idle socket.
    """
    monkeypatch.setattr(settings, "event_stream_lifetime_seconds", lifetime)
    with client.stream("GET", path, params=params, headers=headers) as response:
        yield response, _sse_frames(response.iter_lines())


def open_stream(client, monkeypatch, path, **kwargs):
    """Return the response headers and the first real event of a fresh stream."""
    with sse(client, monkeypatch, path, **kwargs) as (response, frames):
        return response, next(frames)


def latest_event_id(client, monkeypatch, path="/api/v1/hazards/stream"):
    """The cursor a fresh subscription would start from (the snapshot's id)."""
    _, snapshot = open_stream(client, monkeypatch, path)
    assert snapshot["event"] == "snapshot"
    return snapshot["id"]


def test_streams_require_a_token(client):
    token = client.headers.pop("Authorization")
    try:
        hazard = client.get("/api/v1/hazards/stream")
        fleet = client.get("/api/v1/vehicles/stream")
        sos = client.get("/api/v1/sos/stream")
    finally:
        client.headers["Authorization"] = token

    assert [hazard.status_code, fleet.status_code, sos.status_code] == [401, 401, 401]


def test_hazard_stream_sets_the_event_stream_contract_headers(client, monkeypatch):
    response, _ = open_stream(client, monkeypatch, "/api/v1/hazards/stream")

    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-store"
    # Without this some proxies buffer the whole response and the stream only
    # arrives once it closes, which defeats the point.
    assert response.headers["x-accel-buffering"] == "no"


def test_hazard_stream_opens_with_a_snapshot_of_the_active_hazards(client, monkeypatch):
    expected = client.get("/api/v1/hazards", params={"active": True}).json()

    _, snapshot = open_stream(client, monkeypatch, "/api/v1/hazards/stream")

    assert snapshot["event"] == "snapshot"
    assert sorted(row["hazard_id"] for row in snapshot["data"]["hazards"]) == sorted(
        row["hazard_id"] for row in expected
    )


def test_a_created_hazard_reaches_a_subscriber_that_resumes_after_its_cursor(client, monkeypatch):
    cursor = latest_event_id(client, monkeypatch)
    hazard = client.post(
        "/api/v1/hazards",
        json={"name": "Stream probe", "obstruction_level": "CAUTION", "avg_depth_cm": 25},
    ).json()
    try:
        with sse(
            client,
            monkeypatch,
            "/api/v1/hazards/stream",
            params={"after": cursor},
            lifetime=1.5,
        ) as (_, frames):
            created = next(
                frame
                for frame in frames
                if frame["event"] == "hazard.created"
                and frame["data"]["hazard_id"] == hazard["hazard_id"]
            )

        # The event is committed with the row: no window where the subscriber
        # sees the change but the REST read does not, or the other way round.
        assert created["id"] > cursor
        assert created["data"]["name"] == "Stream probe"
        assert created["data"]["obstruction_level"] == "CAUTION"
    finally:
        from sqlalchemy import text

        from database import SessionLocal

        with SessionLocal() as db:
            if hazard.get("hazard_id") is not None:
                db.execute(
                    text("DELETE FROM hazard_zones WHERE hazard_id = :id"),
                    {"id": hazard["hazard_id"]},
                )
                db.commit()


def test_last_event_id_header_resumes_where_the_sse_spec_says(client, monkeypatch):
    cursor = latest_event_id(client, monkeypatch)
    hazard = client.post(
        "/api/v1/hazards",
        json={"name": "Resume probe", "obstruction_level": "CAUTION"},
    ).json()
    try:
        with sse(
            client,
            monkeypatch,
            "/api/v1/hazards/stream",
            params={"after": cursor},
            lifetime=1.5,
        ) as (_, frames):
            created = next(
                frame
                for frame in frames
                if frame["event"] == "hazard.created"
                and frame["data"]["hazard_id"] == hazard["hazard_id"]
            )

        # Now replay as a reconnecting EventSource would: header only, no query.
        with sse(
            client,
            monkeypatch,
            "/api/v1/hazards/stream",
            headers={"Last-Event-ID": str(created["id"])},
            lifetime=0.4,
        ) as (_, frames):
            later = list(frames)

        assert all(frame["id"] > created["id"] for frame in later)
        assert all(frame["event"] != "snapshot" for frame in later)
    finally:
        from sqlalchemy import text

        from database import SessionLocal

        with SessionLocal() as db:
            if hazard.get("hazard_id") is not None:
                db.execute(
                    text("DELETE FROM hazard_zones WHERE hazard_id = :id"),
                    {"id": hazard["hazard_id"]},
                )
                db.commit()


def test_a_malformed_last_event_id_is_refused_rather_than_replayed_from_zero(client):
    response = client.get(
        "/api/v1/hazards/stream",
        headers={"Last-Event-ID": "not-a-number"},
    )

    assert response.status_code == 400
    assert "integer" in response.json()["detail"]


def test_the_fleet_and_sos_streams_are_closed_to_drivers(client, monkeypatch):
    from uuid import uuid4

    from sqlalchemy import text

    from database import SessionLocal

    email = f"stream-driver-{uuid4()}@example.test"
    registered = client.post(
        "/api/v1/auth/register",
        json={"name": "Stream Driver", "email": email, "password": "stream-probe-pass"},
    )
    assert registered.status_code == 201, registered.text

    try:
        login = client.post(
            "/api/v1/auth/login", json={"email": email, "password": "stream-probe-pass"}
        )
        driver = {"Authorization": f"Bearer {login.json()['access_token']}"}

        fleet = client.get("/api/v1/vehicles/stream", headers=driver)
        sos = client.get("/api/v1/sos/stream", headers=driver)

        assert fleet.status_code == 403
        assert sos.status_code == 403

        # A driver does subscribe to hazards: it is the layer the driver map
        # renders, and SEC-007 only withholds the fleet.
        with sse(
            client,
            monkeypatch,
            "/api/v1/hazards/stream",
            headers=driver,
            lifetime=0.4,
        ) as (response, frames):
            assert response.status_code == 200
            assert next(frames)["event"] == "snapshot"
    finally:
        with SessionLocal() as db:
            db.execute(text("DELETE FROM users WHERE email = :email"), {"email": email})
            db.commit()
