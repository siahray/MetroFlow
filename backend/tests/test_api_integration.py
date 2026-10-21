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

import pytest
from fastapi.testclient import TestClient

from main import app

pytestmark = pytest.mark.integration

ALLOWED_STATUSES = {"PASSABLE", "LIGHT_FLOOD", "SUBMERGED"}

# Metro Manila bounding box. Used to prove coordinates are [lon, lat]: a swap
# would put longitude at ~14 and latitude at ~121 and fail these bounds.
LON_RANGE = (120.9, 121.2)
LAT_RANGE = (14.4, 14.8)


@pytest.fixture(scope="session")
def client():
    """
    One app lifespan for the whole session.

    Startup runs seeding and geometry backfill, so re-entering it per test would
    repeat that DDL dozens of times for no benefit.
    """
    with TestClient(app) as test_client:
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
# GeoJSON contract
# ---------------------------------------------------------------------------


def test_network_state_returns_renderable_geojson(client):
    response = client.get("/api/v1/network/state", params={"clearance_cm": 30})
    assert response.status_code == 200

    body = response.json()
    assert body["clearance_cm"] == 30.0
    assert body["edges"]["type"] == "FeatureCollection"
    assert body["nodes"]["type"] == "FeatureCollection"
    assert len(body["edges"]["features"]) == 4
    assert len(body["nodes"]["features"]) == 4

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
    assert body["affected_edges"] == 4
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
