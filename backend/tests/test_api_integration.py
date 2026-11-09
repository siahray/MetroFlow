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


def test_hazard_detail_matches_the_list_row(client, created_records):
    report = submit_report(client, created_records, depth="KNEE", barangay="San Antonio")
    approved = client.post(f"/api/v1/reports/{report['report_id']}/approve", json={})
    hazard_id = approved.json()["hazard_id"]
    created_records[1].append(hazard_id)

    detail = client.get(f"/api/v1/hazards/{hazard_id}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["hazard_id"] == hazard_id
    assert detail.json()["obstruction_level"] == "LEVEL_2"

    assert client.get("/api/v1/hazards/999999").status_code == 404


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


# ---------------------------------------------------------------------------
# Turn-by-turn navigation and live hazard avoidance (FSD-FR-054 to 064)
# ---------------------------------------------------------------------------


def test_route_reports_instructions_road_names_and_total_distance(client):
    response = client.get(
        "/api/v1/routing/navigate",
        params={"start_node": 1, "target_node": 4, "clearance_cm": 60},
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["destination_name"] == "Pasig Blvd - Shaw"
    assert body["total_distance_m"] > 0
    assert sum(segment["distance_m"] for segment in body["segments"]) == pytest.approx(
        body["total_distance_m"]
    )
    assert all(segment["road_name"] for segment in body["segments"])
    assert body["hazards"] == []

    instructions = body["instructions"]
    assert instructions[0]["manoeuvre"] == "DEPART"
    assert instructions[-1]["manoeuvre"] == "ARRIVE"
    assert all(step["text"] for step in instructions)
    # A straight C5 run is one departure plus the arrival, not a turn per node.
    assert len(instructions) == 2
    assert instructions[0]["distance_m"] == pytest.approx(body["total_distance_m"])


def test_a_verified_hazard_closes_its_edge_and_shows_on_the_route(client, created_records):
    # Exactly on the line between nodes 1 and 2, so the 30 m report footprint
    # intersects edge 1 and the verification must close it.
    report = submit_report(
        client, created_records, depth="KNEE", latitude=14.5537, longitude=121.0567
    )
    approved = client.post(f"/api/v1/reports/{report['report_id']}/approve", json={})
    assert approved.status_code == 200, approved.text
    hazard_id = approved.json()["hazard_id"]
    created_records[1].append(hazard_id)

    safe = client.get(
        "/api/v1/routing/navigate",
        params={"start_node": 1, "target_node": 4, "clearance_cm": 60},
    )
    assert safe.status_code == 200, safe.text
    body = safe.json()
    assert 1 not in [segment["edge_id"] for segment in body["segments"]], (
        "a knee-deep verified hazard must exclude the covered edge"
    )
    assert hazard_id not in [hazard["hazard_id"] for hazard in body["hazards"]], (
        "the safe route no longer touches the hazard it routed around"
    )

    # The explicitly unsafe alternative is the only way to cross it, and it
    # still reports the hazard rather than pretending the road is clear.
    unsafe = client.get(
        "/api/v1/routing/navigate",
        params={
            "start_node": 1,
            "target_node": 4,
            "clearance_cm": 60,
            "ignore_hazards": True,
        },
    )
    assert unsafe.status_code == 200, unsafe.text
    assert 1 in [segment["edge_id"] for segment in unsafe.json()["segments"]]
    reported = next(
        hazard for hazard in unsafe.json()["hazards"] if hazard["hazard_id"] == hazard_id
    )
    assert reported["blocking"] is True
    assert reported["obstruction_level"] == "LEVEL_2"
    assert reported["geometry"]["type"] == "Polygon"
    assert reported["warning_radius_m"] == settings.warning_radius_m


def test_caution_hazard_stays_drivable_but_is_reported(client, created_records):
    report = submit_report(
        client, created_records, depth="ANKLE", latitude=14.5537, longitude=121.0567
    )
    approved = client.post(f"/api/v1/reports/{report['report_id']}/approve", json={})
    assert approved.status_code == 200, approved.text
    hazard_id = approved.json()["hazard_id"]
    created_records[1].append(hazard_id)

    response = client.get(
        "/api/v1/routing/navigate",
        params={"start_node": 1, "target_node": 4, "clearance_cm": 60},
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert 1 in [segment["edge_id"] for segment in body["segments"]]
    reported = next(hazard for hazard in body["hazards"] if hazard["hazard_id"] == hazard_id)
    assert reported["blocking"] is False
    assert reported["obstruction_level"] == "CAUTION"


# ---------------------------------------------------------------------------
# Vehicle telemetry ingest (FSD-FR-072, VAL-020, TTC-022)
# ---------------------------------------------------------------------------


def _make_driver_headers(client) -> tuple[dict, str]:
    """Register a fresh EMERGENCY_DRIVER account and return its auth headers + email."""
    from uuid import uuid4

    email = f"telemetry-driver-{uuid4()}@example.test"
    registered = client.post(
        "/api/v1/auth/register",
        json={"name": "Telemetry Driver", "email": email, "password": "telem-pass-123"},
    )
    assert registered.status_code == 201, registered.text
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "telem-pass-123"})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, email


def _cleanup_email(email: str) -> None:
    from sqlalchemy import text

    from database import SessionLocal

    with SessionLocal() as db:
        db.execute(text("DELETE FROM users WHERE email = :email"), {"email": email})
        db.commit()


def _create_test_vehicle(client) -> int:
    """Create a vehicle via admin and return its vehicle_id."""
    resp = client.post(
        "/api/v1/vehicles",
        json={
            "call_sign": "TEST-TELEMETRY",
            "vehicle_type": "flood_truck",
            "clearance_cm": 35,
            "status": "available",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["vehicle_id"]


def _delete_test_vehicle(client, vehicle_id: int) -> None:
    from sqlalchemy import text

    from database import SessionLocal

    with SessionLocal() as db:
        db.execute(text("DELETE FROM vehicles WHERE vehicle_id = :vid"), {"vid": vehicle_id})
        db.commit()


def test_telemetry_updates_vehicle_location(client):
    """A valid ping updates lat/lon/speed on the vehicle row (FSD-FR-072)."""
    driver_headers, email = _make_driver_headers(client)
    vehicle_id = _create_test_vehicle(client)
    try:
        resp = client.post(
            f"/api/v1/vehicles/{vehicle_id}/telemetry",
            json={
                "latitude": 14.5995,
                "longitude": 120.9842,
                "speed_kmh": 30.0,
                "heading": 90.0,
            },
            headers=driver_headers,
        )
        assert resp.status_code == 204, resp.text

        vehicles = client.get("/api/v1/vehicles")
        assert vehicles.status_code == 200, vehicles.text
        row = next(v for v in vehicles.json() if v["vehicle_id"] == vehicle_id)
        assert abs(row["current_location_lat"] - 14.5995) < 1e-6
        assert abs(row["current_location_lon"] - 120.9842) < 1e-6
        assert abs(row["speed_kmh"] - 30.0) < 1e-3
    finally:
        _delete_test_vehicle(client, vehicle_id)
        _cleanup_email(email)


def test_vehicle_detail_matches_the_list_row(client):
    vehicle_id = _create_test_vehicle(client)
    try:
        detail = client.get(f"/api/v1/vehicles/{vehicle_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["vehicle_id"] == vehicle_id
        assert detail.json()["call_sign"] == "TEST-TELEMETRY"

        assert client.get("/api/v1/vehicles/999999").status_code == 404
    finally:
        _delete_test_vehicle(client, vehicle_id)


def test_telemetry_throttles_second_batch_within_window(client):
    """A second ping inside the throttle window is rejected with 429 (VAL-020, TTC-022)."""
    driver_headers, email = _make_driver_headers(client)
    vehicle_id = _create_test_vehicle(client)
    try:
        first = client.post(
            f"/api/v1/vehicles/{vehicle_id}/telemetry",
            json={"latitude": 14.5995, "longitude": 120.9842},
            headers=driver_headers,
        )
        assert first.status_code == 204, first.text

        second = client.post(
            f"/api/v1/vehicles/{vehicle_id}/telemetry",
            json={"latitude": 14.6000, "longitude": 120.9850},
            headers=driver_headers,
        )
        assert second.status_code == 429, second.text
        assert "Retry-After" in second.headers
        assert int(second.headers["Retry-After"]) >= 1
    finally:
        _delete_test_vehicle(client, vehicle_id)
        _cleanup_email(email)


def test_telemetry_allows_batch_after_throttle_window(client):
    """A second ping after the throttle window passes is accepted (TTC-022).

    We back-date ``updated_at`` by 6 s so the telemetry check sees elapsed > 5 s.
    """
    from sqlalchemy import text

    from database import SessionLocal

    driver_headers, email = _make_driver_headers(client)
    vehicle_id = _create_test_vehicle(client)
    try:
        # Back-date updated_at by 6 s so the throttle window has expired.
        with SessionLocal() as db:
            db.execute(
                text(
                    "UPDATE vehicles"
                    " SET updated_at = (NOW() AT TIME ZONE 'UTC') - interval '6 seconds'"
                    " WHERE vehicle_id = :vid"
                ),
                {"vid": vehicle_id},
            )
            db.commit()

        resp = client.post(
            f"/api/v1/vehicles/{vehicle_id}/telemetry",
            json={"latitude": 14.6000, "longitude": 120.9850, "speed_kmh": 20.0},
            headers=driver_headers,
        )
        assert resp.status_code == 204, resp.text

        vehicles = client.get("/api/v1/vehicles")
        row = next(v for v in vehicles.json() if v["vehicle_id"] == vehicle_id)
        assert abs(row["current_location_lat"] - 14.6000) < 1e-6
    finally:
        _delete_test_vehicle(client, vehicle_id)
        _cleanup_email(email)


def test_telemetry_rejects_out_of_range_coordinates(client):
    """Coordinates outside [-90,90] / [-180,180] are rejected with 422."""
    driver_headers, email = _make_driver_headers(client)
    vehicle_id = _create_test_vehicle(client)
    try:
        bad = client.post(
            f"/api/v1/vehicles/{vehicle_id}/telemetry",
            json={"latitude": 999.0, "longitude": 120.9842},
            headers=driver_headers,
        )
        assert bad.status_code == 422, bad.text
    finally:
        _delete_test_vehicle(client, vehicle_id)
        _cleanup_email(email)


def test_telemetry_requires_authentication():
    """Unauthenticated requests to the telemetry endpoint are rejected with 401."""
    with TestClient(app) as anonymous:
        resp = anonymous.post(
            "/api/v1/vehicles/1/telemetry",
            json={"latitude": 14.5995, "longitude": 120.9842},
        )
        assert resp.status_code == 401, resp.text


def test_get_sos_request_by_id(client):
    """An authenticated user can query an SOS request by id (FSD-FR-074)."""
    sos_resp = client.post(
        "/api/v1/sos",
        json={"latitude": 14.6033, "longitude": 120.9822, "note": "Status test"},
    )
    assert sos_resp.status_code == 200, sos_resp.text
    sos_id = sos_resp.json()["sos_id"]

    fetched = client.get(f"/api/v1/sos/{sos_id}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["sos_id"] == sos_id
    assert fetched.json()["status"] == "pending"


def _make_linked_driver(client, vehicle_id: int) -> tuple[dict, str, int]:
    """Create an EMERGENCY_DRIVER bound to `vehicle_id`; return headers, email and id."""
    from uuid import uuid4

    email = f"mission-driver-{uuid4()}@example.test"
    created = client.post(
        "/api/v1/users",
        json={
            "name": "Mission Driver",
            "email": email,
            "password": "mission-pass-123",
            "role": "EMERGENCY_DRIVER",
            "vehicle_id": vehicle_id,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["vehicle_id"] == vehicle_id
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "mission-pass-123"})
    assert login.status_code == 200, login.text
    return (
        {"Authorization": f"Bearer {login.json()['access_token']}"},
        email,
        created.json()["user_id"],
    )


def _delete_sos(sos_id: int) -> None:
    """Remove an SOS row, which the assigned vehicle's FK would otherwise hold."""
    from sqlalchemy import text

    from database import SessionLocal

    with SessionLocal() as db:
        db.execute(text("DELETE FROM sos_requests WHERE sos_id = :sid"), {"sid": sos_id})
        db.commit()


def test_assigned_driver_discovers_and_resolves_mission(client):
    """FSD-FR-074: dispatch reaches the linked driver, who closes it on arrival."""
    sos_id = None
    vehicle_id = None
    driver_id = None
    outsider_email = None
    try:
        vehicle_id = _create_test_vehicle(client)
        driver, _driver_email, driver_id = _make_linked_driver(client, vehicle_id)
        outsider, outsider_email = _make_driver_headers(client)

        # Nothing is dispatched yet.
        idle = client.get(f"/api/v1/vehicles/{vehicle_id}/mission", headers=driver)
        assert idle.status_code == 200, idle.text
        assert idle.json() is None

        sos_id = client.post(
            "/api/v1/sos",
            json={"latitude": 14.6060, "longitude": 120.9850, "note": "Mission test"},
        ).json()["sos_id"]
        assigned = client.post(f"/api/v1/sos/{sos_id}/assign", json={"vehicle_id": vehicle_id})
        assert assigned.status_code == 200, assigned.text

        mission = client.get(f"/api/v1/vehicles/{vehicle_id}/mission", headers=driver)
        assert mission.status_code == 200, mission.text
        assert mission.json()["sos_id"] == sos_id
        assert mission.json()["status"] == "assigned"

        # A driver may not read or close a mission on another unit.
        denied = client.get(f"/api/v1/vehicles/{vehicle_id}/mission", headers=outsider)
        assert denied.status_code == 403, denied.text
        denied_resolve = client.post(f"/api/v1/sos/{sos_id}/resolve", headers=outsider)
        assert denied_resolve.status_code == 403, denied_resolve.text

        resolved = client.post(f"/api/v1/sos/{sos_id}/resolve", headers=driver)
        assert resolved.status_code == 200, resolved.text
        assert resolved.json()["status"] == "resolved"
        assert latest_audit(client, action_type="SOS_RESOLVE")[0]["payload"]["sos_id"] == sos_id

        # The mission is closed and the unit is back in the available pool.
        assert client.get(f"/api/v1/vehicles/{vehicle_id}/mission", headers=driver).json() is None
        fleet = client.get("/api/v1/vehicles")
        row = next(v for v in fleet.json() if v["vehicle_id"] == vehicle_id)
        assert row["status"] == "AVAILABLE"

        # A resolved incident cannot be closed twice.
        again = client.post(f"/api/v1/sos/{sos_id}/resolve", headers=driver)
        assert again.status_code == 409, again.text

        # An operator can unlink the unit again; the account keeps its history.
        unlinked = client.patch(f"/api/v1/users/{driver_id}", json={"vehicle_id": None})
        assert unlinked.status_code == 200, unlinked.text
        assert unlinked.json()["vehicle_id"] is None
    finally:
        if sos_id is not None:
            _delete_sos(sos_id)
        # Audit rows are append-only, so the driver who resolved stays; unlink it
        # from the unit so the test vehicle can be deleted.
        if driver_id is not None:
            client.patch(f"/api/v1/users/{driver_id}", json={"vehicle_id": None})
        if vehicle_id is not None:
            _delete_test_vehicle(client, vehicle_id)
        if outsider_email is not None:
            _cleanup_email(outsider_email)


# ---------------------------------------------------------------------------
# Dispatch Action Persistence & Log (FSD-FR-039 to 046)
# ---------------------------------------------------------------------------


def test_sos_reject_requires_reason_and_persists_audit(client):
    """FSD-FR-039, FSD-FR-044: reject requires reason (min 3 chars) and audits."""
    sos_resp = client.post(
        "/api/v1/sos",
        json={"latitude": 14.6040, "longitude": 120.9830, "note": "Reject test"},
    )
    assert sos_resp.status_code == 200
    sos_id = sos_resp.json()["sos_id"]

    # Reject without reason or short reason fails with 422
    bad_resp = client.post(f"/api/v1/sos/{sos_id}/reject", json={"reason": "no"})
    assert bad_resp.status_code == 422

    # Reject with valid reason
    good_resp = client.post(
        f"/api/v1/sos/{sos_id}/reject",
        json={"reason": "Citizen confirmed resolved locally via callback"},
    )
    assert good_resp.status_code == 200
    assert good_resp.json()["status"] == "rejected"

    # Audited
    audit_row = latest_audit(client, action_type="SOS_REJECT")[0]
    assert audit_row["payload"]["sos_id"] == sos_id
    assert "Citizen confirmed resolved" in audit_row["payload"]["reason"]


def test_sos_hold_and_escalate_and_notes(client):
    """FSD-FR-040, FSD-FR-041, FSD-FR-043: hold, escalate and add notes."""
    sos_resp = client.post(
        "/api/v1/sos",
        json={"latitude": 14.6050, "longitude": 120.9840, "note": "Multi-action test"},
    )
    assert sos_resp.status_code == 200
    sos_id = sos_resp.json()["sos_id"]

    # Hold
    hold_resp = client.post(
        f"/api/v1/sos/{sos_id}/hold",
        json={"reason": "Waiting for sensor buoy telemetry update"},
    )
    assert hold_resp.status_code == 200
    assert hold_resp.json()["status"] == "holding"

    # Note
    note_resp = client.post(
        f"/api/v1/sos/{sos_id}/notes",
        json={"note": "CCTV Sector Delta verified water level stable"},
    )
    assert note_resp.status_code == 200

    # Escalate
    esc_resp = client.post(
        f"/api/v1/sos/{sos_id}/escalate",
        json={
            "agency": "Coast Guard",
            "reason": "Water depth exceeds high-water rescue vehicle clearance",
        },
    )
    assert esc_resp.status_code == 200
    assert esc_resp.json()["status"] == "escalated"

    # Log endpoint returns all actions in chronological order
    log_resp = client.get(f"/api/v1/sos/{sos_id}/log")
    assert log_resp.status_code == 200
    logs = log_resp.json()
    assert len(logs) >= 4  # creation + hold + note + escalate
    assert logs[0]["kind"] == "muted"
    assert any("Waiting for sensor buoy" in item["text"] for item in logs)
    assert any("CCTV Sector Delta" in item["text"] for item in logs)
    assert any("Coast Guard" in item["text"] for item in logs)


def test_dispatch_flow_and_undo_and_constraint(client):
    """FSD-FR-042, FSD-FR-045, FSD-FR-046: assign, confirm, undo, and state constraints."""
    vehicle_id = _create_test_vehicle(client)
    try:
        sos_resp = client.post(
            "/api/v1/sos",
            json={"latitude": 14.6060, "longitude": 120.9850, "note": "Dispatch test"},
        )
        assert sos_resp.status_code == 200
        sos_id = sos_resp.json()["sos_id"]

        # Step 1: Assign vehicle
        assign_resp = client.post(f"/api/v1/sos/{sos_id}/assign", json={"vehicle_id": vehicle_id})
        assert assign_resp.status_code == 200
        assert assign_resp.json()["status"] == "assigned"
        assert assign_resp.json()["vehicle_id"] == vehicle_id

        # Step 2: Confirm dispatch
        confirm_resp = client.post(
            f"/api/v1/dispatch/{sos_id}/confirm",
            json={"note": "Dispatched unit RU-01 via flood-safe corridor"},
        )
        assert confirm_resp.status_code == 200
        assert confirm_resp.json()["status"] == "confirmed"

        # FSD-FR-046: Dispatched incident cannot be re-dispatched or re-assigned
        reassign_resp = client.post(f"/api/v1/sos/{sos_id}/assign", json={"vehicle_id": vehicle_id})
        assert reassign_resp.status_code == 409

        reconfirm_resp = client.post(
            f"/api/v1/dispatch/{sos_id}/confirm",
            json={"note": "Duplicate dispatch attempt"},
        )
        assert reconfirm_resp.status_code == 409

        # Cannot reject an already-dispatched incident
        reject_dispatched = client.post(
            f"/api/v1/sos/{sos_id}/reject",
            json={"reason": "Should fail because already dispatched"},
        )
        assert reject_dispatched.status_code == 409

        # FSD-FR-045: Undo window reverts status back to pending
        undo_resp = client.post(f"/api/v1/dispatch/{sos_id}/undo")
        assert undo_resp.status_code == 200
        assert undo_resp.json()["status"] == "pending"
        assert undo_resp.json()["vehicle_id"] is None

        # FSD-BRULE-011: undo returns the unit to the available pool.
        fleet = client.get("/api/v1/vehicles")
        row = next(v for v in fleet.json() if v["vehicle_id"] == vehicle_id)
        assert row["status"] == "AVAILABLE"
    finally:
        _delete_test_vehicle(client, vehicle_id)


def test_dispatch_preview_ranks_and_blocks_double_booking(client):
    """FSD-FR-088, FSD-FR-089, BRULE-011: preview ranks units; a busy unit is not assignable."""
    resp = client.post(
        "/api/v1/vehicles",
        json={
            "call_sign": "TEST-PREVIEW",
            "vehicle_type": "flood_truck",
            "clearance_cm": 35,
            "status": "AVAILABLE",
            # Must snap to a different node than the SOS below, or the route has no length.
            "current_location_lat": 14.5850,
            "current_location_lon": 121.0560,
        },
    )
    assert resp.status_code == 200, resp.text
    vehicle_id = resp.json()["vehicle_id"]
    try:
        sos_id = client.post(
            "/api/v1/sos",
            json={"latitude": 14.6060, "longitude": 120.9850, "note": "Preview test"},
        ).json()["sos_id"]

        preview = client.get(f"/api/v1/dispatch/{sos_id}/preview")
        assert preview.status_code == 200, preview.text
        units = preview.json()["units"]
        row = next(unit for unit in units if unit["vehicle_id"] == vehicle_id)
        assert row["estimated_travel_time_minutes"] is not None
        assert row["total_distance_m"] > 0

        # Ranked fastest first; unroutable units keep a place at the end.
        routed = [
            unit["estimated_travel_time_minutes"]
            for unit in units
            if unit["estimated_travel_time_minutes"] is not None
        ]
        assert routed == sorted(routed)

        # BRULE-011: assigning marks the unit DISPATCHED.
        assert (
            client.post(f"/api/v1/sos/{sos_id}/assign", json={"vehicle_id": vehicle_id}).status_code
            == 200
        )
        fleet = client.get("/api/v1/vehicles")
        assert next(v for v in fleet.json() if v["vehicle_id"] == vehicle_id)["status"] == (
            "DISPATCHED"
        )

        # BUSY unit cannot take a second incident.
        sos2_id = client.post(
            "/api/v1/sos",
            json={"latitude": 14.6010, "longitude": 120.9900, "note": "Second incident"},
        ).json()["sos_id"]
        blocked = client.post(f"/api/v1/sos/{sos2_id}/assign", json={"vehicle_id": vehicle_id})
        assert blocked.status_code == 409

        # Undo frees the unit, so the second incident can now take it.
        first = client.post(f"/api/v1/dispatch/{sos_id}/confirm", json={})
        assert first.status_code == 200, first.text
        assert client.post(f"/api/v1/dispatch/{sos_id}/undo").status_code == 200
        assert (
            client.post(
                f"/api/v1/sos/{sos2_id}/assign", json={"vehicle_id": vehicle_id}
            ).status_code
            == 200
        )
        second = client.post(f"/api/v1/dispatch/{sos2_id}/confirm", json={})
        assert second.status_code == 200, second.text
        assert client.post(f"/api/v1/dispatch/{sos2_id}/undo").status_code == 200
    finally:
        _delete_test_vehicle(client, vehicle_id)


def test_user_management_crud(client):
    """FSD-FR-048: Admin can list, create, update, and delete users with audit trail."""
    # List users
    users = client.get("/api/v1/users")
    assert users.status_code == 200
    initial_count = len(users.json())

    # Create a new user
    create_resp = client.post(
        "/api/v1/users",
        json={
            "name": "Test Dispatcher",
            "email": "test.dispatcher@example.com",
            "password": "SecurePass123",
            "role": "LGU_DISPATCHER",
        },
    )
    assert create_resp.status_code == 201
    user_id = create_resp.json()["user_id"]
    assert create_resp.json()["role"] == "LGU_DISPATCHER"

    # Verify user appears in list
    users_after = client.get("/api/v1/users")
    assert users_after.status_code == 200
    assert len(users_after.json()) == initial_count + 1

    # Update user
    update_resp = client.patch(
        f"/api/v1/users/{user_id}",
        json={"name": "Updated Name", "role": "SUPER_ADMIN"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated Name"
    assert update_resp.json()["role"] == "SUPER_ADMIN"

    # Cannot update to invalid role
    bad_role = client.patch(
        f"/api/v1/users/{user_id}",
        json={"role": "INVALID_ROLE"},
    )
    assert bad_role.status_code == 422

    # Cannot create duplicate email
    duplicate = client.post(
        "/api/v1/users",
        json={
            "name": "Another User",
            "email": "test.dispatcher@example.com",
            "password": "AnotherPass123",
            "role": "LGU_DISPATCHER",
        },
    )
    assert duplicate.status_code == 409

    # Delete user
    delete_resp = client.delete(f"/api/v1/users/{user_id}")
    assert delete_resp.status_code == 204

    # Verify user is gone
    users_final = client.get("/api/v1/users")
    assert users_final.status_code == 200
    assert len(users_final.json()) == initial_count


def test_user_management_self_protection(client):
    """FSD-FR-048: Users cannot modify or delete their own account."""
    # Get current user info
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    my_id = me.json()["user_id"]

    # Cannot update own account
    self_update = client.patch(
        f"/api/v1/users/{my_id}",
        json={"name": "Hacked Name"},
    )
    assert self_update.status_code == 403

    # Cannot delete own account
    self_delete = client.delete(f"/api/v1/users/{my_id}")
    assert self_delete.status_code == 403


def test_user_management_last_admin_protection(client):
    """FSD-FR-048: the only administrator cannot be deleted.

    The caller of this admin-only route is itself an administrator, so deleting the
    sole admin is always a self-delete and is refused (403) before the last-admin
    check (409) can apply; the 409 stays as defence in depth.
    """
    users = client.get("/api/v1/users")
    assert users.status_code == 200
    admins = [u for u in users.json() if u["role"] in ("SUPER_ADMIN", "LGU_DISPATCHER")]

    if len(admins) == 1:
        admin_id = admins[0]["user_id"]
        delete_resp = client.delete(f"/api/v1/users/{admin_id}")
        assert delete_resp.status_code == 403
        assert "own account" in delete_resp.json()["detail"].lower()
        # The refusal changed nothing.
        remaining = client.get("/api/v1/users").json()
        assert any(u["user_id"] == admin_id for u in remaining)


def test_export_audit_csv(client):
    """FSD-FR-049: Admin can export audit logs as CSV."""
    resp = client.get("/api/v1/audit/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/csv; charset=utf-8"
    assert "attachment" in resp.headers["content-disposition"]

    # Verify CSV has header row
    content = resp.text
    lines = content.split("\n")
    assert len(lines) > 1
    assert "log_id,user_id,action_type" in lines[0]


def test_export_incidents_csv(client):
    """FSD-FR-049: Admin can export incidents as CSV."""
    resp = client.get("/api/v1/incidents/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/csv; charset=utf-8"
    assert "attachment" in resp.headers["content-disposition"]

    # Verify CSV has header row
    content = resp.text
    lines = content.split("\n")
    assert len(lines) > 1
    assert "sos_id,latitude,longitude" in lines[0]


def test_sensor_reading_rejection(client):
    """FSD-FR-090: Reject readings from unknown or disabled sensors."""
    # Unknown sensor
    resp = client.post(
        "/api/v1/sensors/readings",
        json={
            "sensor_id": "UNKNOWN_SENSOR",
            "value": 10.5,
            "unit": "m",
            "recorded_at": "2026-11-02T10:00:00Z",
        },
    )
    assert resp.status_code == 404

    # Future timestamp
    _make_sensor(client, "TEST_SENSOR", 14.6, 121.0, radius_m=100.0, unit="m")
    try:
        resp = client.post(
            "/api/v1/sensors/readings",
            json={
                "sensor_id": "TEST_SENSOR",
                "value": 10.5,
                "unit": "m",
                "recorded_at": "2099-01-01T00:00:00Z",
            },
        )
        assert resp.status_code == 422
    finally:
        client.delete("/api/v1/sensors/TEST_SENSOR")


def test_sensor_registry_crud(client):
    """FSD-FR-091: Admin can list, create, update, and delete sensors."""
    # Create a sensor
    create_resp = client.post(
        "/api/v1/sensors",
        json={
            "sensor_id": "TEST_RIVER_01",
            "sensor_type": "RIVER_GAUGE",
            "name": "Test River Gauge",
            "threshold_value": 5.0,
            "threshold_unit": "m",
            "impact_radius_m": 1000.0,
            "latitude": 14.6,
            "longitude": 121.0,
            "simulated": True,
        },
    )
    assert create_resp.status_code == 201
    assert create_resp.json()["sensor_id"] == "TEST_RIVER_01"

    # List sensors
    list_resp = client.get("/api/v1/sensors")
    assert list_resp.status_code == 200
    sensors = list_resp.json()
    assert any(s["sensor_id"] == "TEST_RIVER_01" for s in sensors)

    # Update sensor
    update_resp = client.patch(
        "/api/v1/sensors/TEST_RIVER_01",
        json={"name": "Updated Name", "threshold_value": 6.0},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated Name"
    assert update_resp.json()["threshold_value"] == 6.0

    # Invalid sensor type
    bad_type = client.post(
        "/api/v1/sensors",
        json={
            "sensor_id": "BAD_SENSOR",
            "sensor_type": "INVALID_TYPE",
            "name": "Bad Sensor",
            "threshold_value": 5.0,
            "threshold_unit": "m",
            "impact_radius_m": 1000.0,
            "latitude": 14.6,
            "longitude": 121.0,
        },
    )
    assert bad_type.status_code == 422

    # Duplicate sensor_id
    duplicate = client.post(
        "/api/v1/sensors",
        json={
            "sensor_id": "TEST_RIVER_01",
            "sensor_type": "RAIN_GAUGE",
            "name": "Duplicate",
            "threshold_value": 5.0,
            "threshold_unit": "mm_hr",
            "impact_radius_m": 1000.0,
            "latitude": 14.6,
            "longitude": 121.0,
        },
    )
    assert duplicate.status_code == 409

    # Delete sensor
    delete_resp = client.delete("/api/v1/sensors/TEST_RIVER_01")
    assert delete_resp.status_code == 204


def _make_sensor(client, sensor_id, lat, lon, radius_m, unit="mm_hr", threshold=50.0):
    resp = client.post(
        "/api/v1/sensors",
        json={
            "sensor_id": sensor_id,
            "sensor_type": "RAIN_GAUGE",
            "name": sensor_id,
            "latitude": lat,
            "longitude": lon,
            "threshold_value": threshold,
            "threshold_unit": unit,
            "impact_radius_m": radius_m,
            "simulated": True,
        },
    )
    assert resp.status_code == 201, resp.text


def _post_reading(client, sensor_id, value, unit="mm_hr"):
    return client.post(
        "/api/v1/sensors/readings",
        json={
            "sensor_id": sensor_id,
            "value": value,
            "unit": unit,
            "recorded_at": "2026-11-02T10:00:00Z",
        },
    )


def test_sensor_breach_lists_only_edges_inside_the_radius_in_metres(client):
    """FSD-FR-091: the radius is metres, so a 50 m gauge must not reach the whole map."""
    node = {n.node_id: n for n in SEED_NODES}
    edge = SEED_EDGES[0]
    a, b = node[edge.start_node_id], node[edge.end_node_id]
    lat, lon = (a.latitude + b.latitude) / 2, (a.longitude + b.longitude) / 2

    _make_sensor(client, "TEST_RAIN_NEAR", lat, lon, radius_m=50.0)
    try:
        # Below threshold: stored, no breach, nothing audited as a breach.
        quiet = _post_reading(client, "TEST_RAIN_NEAR", 10.0)
        assert quiet.status_code == 201
        assert quiet.json()["breach"] is False

        loud = _post_reading(client, "TEST_RAIN_NEAR", 80.0)
        assert loud.status_code == 201
        assert loud.json()["breach"] is True

        entries = client.get("/api/v1/audit", params={"action_type": "SENSOR_BREACH"}).json()
        edge_ids = next(e for e in entries if e["payload"]["sensor_id"] == "TEST_RAIN_NEAR")[
            "payload"
        ]["impacted_edge_ids"]
        assert edge.edge_id in edge_ids
        assert 0 < len(edge_ids) < EDGE_COUNT
    finally:
        client.delete("/api/v1/sensors/TEST_RAIN_NEAR")


def test_sensor_reading_unit_must_match_the_sensor(client):
    """A mismatched unit used to return 201 and silently never breach."""
    _make_sensor(client, "TEST_RAIN_UNIT", 14.6, 121.0, radius_m=100.0, unit="mm_hr")
    try:
        assert _post_reading(client, "TEST_RAIN_UNIT", 80.0, unit="m").status_code == 422
        assert _post_reading(client, "TEST_RAIN_UNIT", -1.0).status_code == 422
    finally:
        client.delete("/api/v1/sensors/TEST_RAIN_UNIT")


def test_nearest_sensor_distance_is_in_kilometres(client, created_records):
    """ST_Distance on 4326 geometry is degrees; the endpoint must report real km."""
    lat, lon = 14.6, 121.0
    _make_sensor(client, "TEST_RAIN_DIST", lat, lon, radius_m=100.0)
    try:
        report = submit_report(client, created_records, latitude=lat + 0.009, longitude=lon)
        got = client.get(f"/api/v1/reports/{report['report_id']}/nearest-sensor").json()
        # 0.009 degrees of latitude is about 1.0 km.
        assert 0.9 < got["distance_km"] < 1.1
    finally:
        client.delete("/api/v1/sensors/TEST_RAIN_DIST")


def test_report_replay_with_the_same_client_id_is_stored_once(client, created_records):
    client_id = str(__import__("uuid").uuid4())
    first = submit_report(client, created_records, client_id=client_id)
    second = submit_report(client, created_records, client_id=client_id)
    assert second["report_id"] == first["report_id"]


def test_every_public_table_has_row_level_security(client):
    """Supabase exposes the schema over PostgREST: a table without RLS is open to the anon key.

    spatial_ref_sys is the PostGIS system catalogue, owned by the extension.
    """
    from sqlalchemy import text

    from database import engine

    with engine.connect() as connection:
        open_tables = [
            row[0]
            for row in connection.execute(
                text(
                    "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
                    "WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity "
                    "AND c.relname <> 'spatial_ref_sys' ORDER BY 1"
                )
            )
        ]
    assert open_tables == [], f"tables without row level security: {open_tables}"


# --- CR-004: flood state per road segment ----------------------------------


def _read_at(client, sensor_id, value, minutes_ago, unit="mm_hr"):
    """Post a reading that applies ``minutes_ago`` minutes before now."""
    from datetime import UTC, datetime, timedelta

    recorded = datetime.now(UTC) - timedelta(minutes=minutes_ago)
    return client.post(
        "/api/v1/sensors/readings",
        json={
            "sensor_id": sensor_id,
            "value": value,
            "unit": unit,
            "recorded_at": recorded.isoformat().replace("+00:00", "Z"),
        },
    )


def _flood_state(client):
    response = client.get("/api/v1/flood-state")
    assert response.status_code == 200, response.text
    return response.json()


def _by_edge(state):
    return {e["edge_id"]: e for e in state["edges"]}


def _midpoint_of_first_edge():
    node = {n.node_id: n for n in SEED_NODES}
    edge = SEED_EDGES[0]
    a, b = node[edge.start_node_id], node[edge.end_node_id]
    return edge.edge_id, (a.latitude + b.latitude) / 2, (a.longitude + b.longitude) / 2


def test_a_breach_flags_only_the_roads_in_range_as_an_advisory_that_never_closes(client):
    """TC-059, FSD-FR-091, BRULE-016."""
    edge_id, lat, lon = _midpoint_of_first_edge()
    _make_sensor(client, "TEST_FS_NEAR", lat, lon, radius_m=50.0)
    try:
        assert _read_at(client, "TEST_FS_NEAR", 80.0, minutes_ago=2).status_code == 201
        edges = _by_edge(_flood_state(client))

        hit = edges[edge_id]
        assert hit["basis"] == "LIVE_ADVISORY"
        assert hit["advisory"] is True
        assert hit["closes_road"] is False
        assert hit["source"] == "SENSOR:TEST_FS_NEAR"
        assert hit["kind"] == "SIMULATED"  # the test sensor is created as simulated
        assert hit["as_of"] is not None

        flagged = [e for e in edges.values() if e["basis"] == "LIVE_ADVISORY"]
        assert 0 < len(flagged) < len(edges)
        # Everything out of range has no live data, which is not the same as safe.
        quiet = next(e for e in edges.values() if e["basis"] == "NONE")
        assert quiet["has_live_data"] is False
        assert "No live data covers this segment" in quiet["notes"]
    finally:
        client.delete("/api/v1/sensors/TEST_FS_NEAR")


def test_a_quiet_reading_clears_the_advisory_but_still_counts_as_live_data(client):
    edge_id, lat, lon = _midpoint_of_first_edge()
    _make_sensor(client, "TEST_FS_CLEAR", lat, lon, radius_m=50.0)
    try:
        assert _read_at(client, "TEST_FS_CLEAR", 80.0, minutes_ago=4).status_code == 201
        assert _by_edge(_flood_state(client))[edge_id]["basis"] == "LIVE_ADVISORY"

        assert _read_at(client, "TEST_FS_CLEAR", 5.0, minutes_ago=1).status_code == 201
        cleared = _by_edge(_flood_state(client))[edge_id]
        assert cleared["basis"] == "NONE"
        assert cleared["has_live_data"] is True
    finally:
        client.delete("/api/v1/sensors/TEST_FS_CLEAR")


def test_a_stale_breach_is_ignored_and_reported_as_stale_not_as_safe(client):
    """TC-060: past the freshness window the reading no longer counts."""
    edge_id, lat, lon = _midpoint_of_first_edge()
    _make_sensor(client, "TEST_FS_STALE", lat, lon, radius_m=50.0)
    try:
        assert _read_at(client, "TEST_FS_STALE", 80.0, minutes_ago=45).status_code == 201
        edge = _by_edge(_flood_state(client))[edge_id]
        assert edge["basis"] == "NONE"
        assert edge["stale"] is True
        assert "A flagged reading is out of date and was ignored" in edge["notes"]
    finally:
        client.delete("/api/v1/sensors/TEST_FS_STALE")


def test_an_older_reading_arriving_late_never_overwrites_a_newer_one(client):
    edge_id, lat, lon = _midpoint_of_first_edge()
    _make_sensor(client, "TEST_FS_ORDER", lat, lon, radius_m=50.0)
    try:
        assert _read_at(client, "TEST_FS_ORDER", 80.0, minutes_ago=2).status_code == 201
        # A quiet reading from 10 minutes ago arrives afterwards (delayed delivery).
        assert _read_at(client, "TEST_FS_ORDER", 5.0, minutes_ago=10).status_code == 201
        assert _by_edge(_flood_state(client))[edge_id]["basis"] == "LIVE_ADVISORY"
    finally:
        client.delete("/api/v1/sensors/TEST_FS_ORDER")


def test_deleting_a_sensor_removes_its_advisories(client):
    edge_id, lat, lon = _midpoint_of_first_edge()
    _make_sensor(client, "TEST_FS_GONE", lat, lon, radius_m=50.0)
    assert _read_at(client, "TEST_FS_GONE", 80.0, minutes_ago=1).status_code == 201
    assert _by_edge(_flood_state(client))[edge_id]["basis"] == "LIVE_ADVISORY"

    assert client.delete("/api/v1/sensors/TEST_FS_GONE").status_code in (200, 204)
    gone = _by_edge(_flood_state(client))[edge_id]
    assert gone["basis"] == "NONE"
    assert gone["has_live_data"] is False


def test_only_flagged_leaves_out_segments_with_nothing_to_report(client):
    edge_id, lat, lon = _midpoint_of_first_edge()
    _make_sensor(client, "TEST_FS_FILTER", lat, lon, radius_m=50.0)
    try:
        assert _read_at(client, "TEST_FS_FILTER", 80.0, minutes_ago=1).status_code == 201
        everything = _flood_state(client)["edges"]
        flagged = client.get("/api/v1/flood-state", params={"only_flagged": "true"}).json()["edges"]
        assert 0 < len(flagged) < len(everything)
        assert all(e["basis"] != "NONE" or e["stale"] for e in flagged)
    finally:
        client.delete("/api/v1/sensors/TEST_FS_FILTER")


def test_flood_state_requires_a_session(client):
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as anonymous:
        assert anonymous.get("/api/v1/flood-state").status_code == 401


# --- Fleet management: the super admin adds, edits and removes units --------


def _unit(client, call_sign, **over):
    body = {"call_sign": call_sign, "vehicle_type": "RESCUE_BOAT", "clearance_cm": 60, **over}
    return client.post("/api/v1/vehicles", json=body)


def _audit_count(client, action_type):
    return len(client.get("/api/v1/audit", params={"action_type": action_type}).json())


def test_super_admin_adds_edits_and_removes_a_unit_with_one_audit_entry_each(client):
    created_before = _audit_count(client, "VEHICLE_CREATE")
    updated_before = _audit_count(client, "VEHICLE_UPDATE")
    deleted_before = _audit_count(client, "VEHICLE_DELETE")

    added = _unit(client, "TEST-FLEET-1", status="available")
    assert added.status_code == 200, added.text
    unit = added.json()
    vehicle_id = unit["vehicle_id"]
    assert unit["status"] == "AVAILABLE"  # normalised
    assert unit["clearance_cm"] == 60

    edited = client.patch(
        f"/api/v1/vehicles/{vehicle_id}",
        json={"call_sign": "TEST-FLEET-1B", "clearance_cm": 75, "status": "out_of_service"},
    )
    assert edited.status_code == 200, edited.text
    assert (edited.json()["call_sign"], edited.json()["clearance_cm"], edited.json()["status"]) == (
        "TEST-FLEET-1B",
        75,
        "OUT_OF_SERVICE",
    )
    assert any(v["vehicle_id"] == vehicle_id for v in client.get("/api/v1/vehicles").json())

    assert client.delete(f"/api/v1/vehicles/{vehicle_id}").status_code == 204
    assert all(v["vehicle_id"] != vehicle_id for v in client.get("/api/v1/vehicles").json())
    assert client.delete(f"/api/v1/vehicles/{vehicle_id}").status_code == 404

    assert _audit_count(client, "VEHICLE_CREATE") == created_before + 1
    assert _audit_count(client, "VEHICLE_UPDATE") == updated_before + 1
    assert _audit_count(client, "VEHICLE_DELETE") == deleted_before + 1


def test_a_call_sign_cannot_be_reused_even_in_a_different_case(client):
    first = _unit(client, "TEST-FLEET-DUP")
    assert first.status_code == 200
    other = _unit(client, "TEST-FLEET-OTHER")
    assert other.status_code == 200
    try:
        assert _unit(client, "test-fleet-dup").status_code == 409
        clash = client.patch(
            f"/api/v1/vehicles/{other.json()['vehicle_id']}", json={"call_sign": "Test-Fleet-Dup"}
        )
        assert clash.status_code == 409
    finally:
        for created in (first, other):
            client.delete(f"/api/v1/vehicles/{created.json()['vehicle_id']}")


def test_a_unit_is_validated_before_it_is_stored(client):
    assert _unit(client, "TEST-FLEET-BAD", status="flying").status_code == 422
    assert _unit(client, "TEST-FLEET-BAD", clearance_cm=0).status_code == 422
    assert _unit(client, "TEST-FLEET-BAD", clearance_cm=900).status_code == 422
    assert _unit(client, "   ").status_code == 422
    assert _unit(client, "TEST-FLEET-BAD", current_location_lat=123).status_code == 422


def test_a_unit_on_a_live_dispatch_cannot_be_removed_but_a_finished_one_can(client):
    unit = _unit(
        client, "TEST-FLEET-BUSY", current_location_lat=14.5850, current_location_lon=121.0560
    )
    assert unit.status_code == 200
    vehicle_id = unit.json()["vehicle_id"]
    sos_id = client.post(
        "/api/v1/sos",
        json={"latitude": 14.6060, "longitude": 120.9850, "note": "fleet delete test"},
    ).json()["sos_id"]
    try:
        assert (
            client.post(f"/api/v1/sos/{sos_id}/assign", json={"vehicle_id": vehicle_id}).status_code
            == 200
        )
        blocked = client.delete(f"/api/v1/vehicles/{vehicle_id}")
        assert blocked.status_code == 409
        assert "dispatch" in blocked.json()["detail"].lower()

        # Rejecting the incident releases the unit, but the incident still points at it.
        assert (
            client.post(f"/api/v1/sos/{sos_id}/reject", json={"reason": "fleet test"}).status_code
            == 200
        )
        assert client.delete(f"/api/v1/vehicles/{vehicle_id}").status_code == 204
        # The finished incident keeps its record, with the unit detached.
        remaining = next(s for s in client.get("/api/v1/sos").json() if s["sos_id"] == sos_id)
        assert remaining["status"] == "rejected"
        assert remaining["vehicle_id"] is None
    finally:
        # Free the unit whatever happened above, then remove it through the API, which
        # detaches any incident that still points at it.
        client.post(f"/api/v1/sos/{sos_id}/reject", json={"reason": "fleet test cleanup"})
        client.delete(f"/api/v1/vehicles/{vehicle_id}")


def test_a_dispatcher_can_see_the_fleet_but_not_change_it(client):
    from fastapi.testclient import TestClient

    from main import app

    created = client.post(
        "/api/v1/users",
        json={
            "name": "Fleet Test Dispatcher",
            "email": "fleet.dispatcher@example.com",
            "password": "SecurePass123",
            "role": "LGU_DISPATCHER",
        },
    )
    assert created.status_code == 201, created.text
    user_id = created.json()["user_id"]
    unit = _unit(client, "TEST-FLEET-GUARD")
    assert unit.status_code == 200
    vehicle_id = unit.json()["vehicle_id"]
    try:
        with TestClient(app) as dispatcher:
            login = dispatcher.post(
                "/api/v1/auth/login",
                json={"email": "fleet.dispatcher@example.com", "password": "SecurePass123"},
            )
            assert login.status_code == 200, login.text
            dispatcher.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

            assert dispatcher.get("/api/v1/vehicles").status_code == 200
            assert _unit(dispatcher, "TEST-FLEET-NOPE").status_code == 403
            assert (
                dispatcher.patch(
                    f"/api/v1/vehicles/{vehicle_id}", json={"clearance_cm": 99}
                ).status_code
                == 403
            )
            assert dispatcher.delete(f"/api/v1/vehicles/{vehicle_id}").status_code == 403
        # Nothing was changed by the refused calls.
        assert (
            next(v for v in client.get("/api/v1/vehicles").json() if v["vehicle_id"] == vehicle_id)[
                "clearance_cm"
            ]
            == 60
        )
    finally:
        client.delete(f"/api/v1/vehicles/{vehicle_id}")
        client.delete(f"/api/v1/users/{user_id}")
