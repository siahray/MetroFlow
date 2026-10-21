import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from config import settings
from database import Base, engine, get_db
from geometry import backfill_geometry
from hydrology import calculate_scs_cn_runoff, compute_node_water_depth
from routing import classify_passability, td_a_star_search
from schemas import (
    EdgeFeature,
    EdgeFeatureCollection,
    EdgeProperties,
    NetworkStateResponse,
    NodeFeature,
    NodeFeatureCollection,
    NodeProperties,
    RouteResponse,
    RouteSegment,
    SimulationResponse,
)

# ---------------------------------------------------------------------------
# Seeding + geometry backfill
# ---------------------------------------------------------------------------


def seed_database(db: Session) -> None:
    """Seed the Taguig / Pasig corridor demo graph on first boot."""
    if db.query(models.RoadNode).count() > 0:
        return

    nodes = [
        models.RoadNode(
            node_id=1,
            name="C5 - Market Market",
            latitude=14.5491,
            longitude=121.0553,
            elevation_m=8.5,
        ),
        models.RoadNode(
            node_id=2,
            name="C5 - Kalayaan Ave",
            latitude=14.5583,
            longitude=121.0581,
            elevation_m=4.2,
        ),  # Low elevation
        models.RoadNode(
            node_id=3,
            name="C5 - Bagong Ilog",
            latitude=14.5672,
            longitude=121.0631,
            elevation_m=3.5,
        ),  # Low elevation
        models.RoadNode(
            node_id=4,
            name="Pasig Blvd - Shaw",
            latitude=14.5731,
            longitude=121.0685,
            elevation_m=9.0,
        ),
    ]
    db.add_all(nodes)
    db.commit()

    edges = [
        models.RoadEdge(
            edge_id=1, start_node_id=1, end_node_id=2, distance_meters=1100.0, max_speed_kmh=60.0
        ),
        models.RoadEdge(
            edge_id=2, start_node_id=2, end_node_id=3, distance_meters=1000.0, max_speed_kmh=50.0
        ),
        models.RoadEdge(
            edge_id=3, start_node_id=3, end_node_id=4, distance_meters=850.0, max_speed_kmh=50.0
        ),
        models.RoadEdge(
            edge_id=4, start_node_id=1, end_node_id=4, distance_meters=2800.0, max_speed_kmh=40.0
        ),  # Alternative route
    ]
    db.add_all(edges)
    db.commit()

    for edge in edges:
        db.add(
            models.LiveEdgeState(
                edge_id=edge.edge_id, water_depth_cm=0.0, avg_speed_kmh=edge.max_speed_kmh
            )
        )
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        seed_database(db)
        result = backfill_geometry(db)
        print(
            f"[startup] geometry backfill: {result['nodes_updated']} nodes, "
            f"{result['edges_updated']} edges populated"
        )
    finally:
        db.close()
    yield


app = FastAPI(
    title="MetroFlow Core API Engine",
    description="Intelligent Urban Mobility & Flood Simulation System",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Next.js & React Native Frontend Clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------


def _load_graph(db: Session):
    """Load nodes, edges and live state in three fixed queries (no N+1)."""
    nodes = {n.node_id: n for n in db.query(models.RoadNode).all()}
    edges = db.query(models.RoadEdge).order_by(models.RoadEdge.edge_id).all()
    states = {s.edge_id: s for s in db.query(models.LiveEdgeState).all()}
    return nodes, edges, states


def _load_edge_geometry(db: Session) -> dict[int, Any]:
    """Fetch every edge geometry as parsed GeoJSON, keyed by edge_id."""
    rows = db.query(
        models.RoadEdge.edge_id,
        func.ST_AsGeoJSON(models.RoadEdge.geom),
    ).all()

    geometry: dict[int, Any] = {}
    for edge_id, raw in rows:
        if raw:
            geometry[edge_id] = json.loads(raw)
    return geometry


def _straight_line(start: models.RoadNode, end: models.RoadNode) -> list[list[float]]:
    """Fallback geometry in GeoJSON order: [longitude, latitude]."""
    return [
        [start.longitude, start.latitude],
        [end.longitude, end.latitude],
    ]


def _edge_coordinates(
    geometry: dict[str, Any] | None,
    start: models.RoadNode,
    end: models.RoadNode,
) -> list[list[float]]:
    """Prefer PostGIS geometry; fall back to endpoint endpoints if it is missing."""
    if geometry and geometry.get("type") == "LineString":
        coordinates = geometry.get("coordinates") or []
        if len(coordinates) >= 2:
            return coordinates
    return _straight_line(start, end)


def _build_network_state(db: Session, clearance_cm: float) -> NetworkStateResponse:
    """Assemble the renderable road network for one vehicle clearance profile."""
    nodes, edges, states = _load_graph(db)
    geometry = _load_edge_geometry(db)

    edge_features: list[EdgeFeature] = []
    for edge in edges:
        start = nodes.get(edge.start_node_id)
        end = nodes.get(edge.end_node_id)
        if start is None or end is None:
            continue

        state = states.get(edge.edge_id)
        water_depth_cm = float(state.water_depth_cm) if state else 0.0

        edge_features.append(
            EdgeFeature(
                id=edge.edge_id,
                geometry={
                    "type": "LineString",
                    "coordinates": _edge_coordinates(geometry.get(edge.edge_id), start, end),
                },
                properties=EdgeProperties(
                    edge_id=edge.edge_id,
                    start_node_id=edge.start_node_id,
                    end_node_id=edge.end_node_id,
                    start_name=start.name,
                    end_name=end.name,
                    distance_m=edge.distance_meters,
                    max_speed_kmh=edge.max_speed_kmh,
                    avg_speed_kmh=float(state.avg_speed_kmh) if state else edge.max_speed_kmh,
                    water_depth_cm=round(water_depth_cm, 2),
                    status=classify_passability(water_depth_cm, clearance_cm),
                    is_override=bool(state.is_override) if state else False,
                ),
            )
        )

    node_features: list[NodeFeature] = []
    for node in nodes.values():
        node_features.append(
            NodeFeature(
                id=node.node_id,
                geometry={
                    "type": "Point",
                    "coordinates": [node.longitude, node.latitude],
                },
                properties=NodeProperties(
                    node_id=node.node_id,
                    name=node.name,
                    elevation_m=node.elevation_m,
                ),
            )
        )

    node_features.sort(key=lambda feature: feature.id)

    return NetworkStateResponse(
        clearance_cm=clearance_cm,
        generated_at=datetime.now(UTC),
        edges=EdgeFeatureCollection(features=edge_features),
        nodes=NodeFeatureCollection(features=node_features),
    )


def _require_node(nodes: dict[int, models.RoadNode], node_id: int, label: str) -> None:
    if node_id not in nodes:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown {label} {node_id}. Available nodes: {sorted(nodes)}",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/")
def root():
    return {
        "status": "online",
        "system": "MetroFlow API Core Engine",
        "architecture": "Dual-Interface (LGU + Driver)",
    }


@app.get("/api/v1/network/state", response_model=NetworkStateResponse)
def get_network_state(
    clearance_cm: Annotated[
        float, Query(gt=0, le=200, description="Vehicle clearance in cm")
    ] = settings.default_clearance_cm,
    db: Session = Depends(get_db),
):
    """
    Return every road edge (with live flood depth and passability status) and
    every road node as GeoJSON FeatureCollections, ready for a MapLibre source.

    Colour the map from ``properties.status``:
      PASSABLE    -> green
      LIGHT_FLOOD -> yellow
      SUBMERGED   -> red (impassable for this clearance)
    """
    return _build_network_state(db, clearance_cm)


@app.post("/api/v1/simulation/rain", response_model=SimulationResponse)
def trigger_rainfall_simulation(
    rainfall_mm_hr: Annotated[float, Query(ge=0, le=250, description="Rainfall intensity (mm/hr)")],
    clearance_cm: Annotated[
        float, Query(gt=0, le=200, description="Vehicle clearance in cm")
    ] = settings.default_clearance_cm,
    db: Session = Depends(get_db),
):
    """
    Run the SCS-CN runoff model over the road graph.

    Returns the resulting network as GeoJSON in the same response, so the map
    can update without a follow-up request.
    """
    runoff_mm = calculate_scs_cn_runoff(rainfall_mm_hr)
    nodes, edges, states = _load_graph(db)

    affected_edges = 0
    for edge in edges:
        state = states.get(edge.edge_id)
        if state is None or state.is_override:
            continue

        start = nodes.get(edge.start_node_id)
        elevation_m = start.elevation_m if start else 5.0
        water_depth = compute_node_water_depth(runoff_mm, elevation_m=elevation_m)

        state.water_depth_cm = water_depth
        state.avg_speed_kmh = max(10.0, edge.max_speed_kmh - (water_depth * 0.8))
        affected_edges += 1

    db.commit()

    network = _build_network_state(db, clearance_cm)
    return SimulationResponse(
        **network.model_dump(),
        rainfall_mm_hr=rainfall_mm_hr,
        runoff_mm=round(runoff_mm, 4),
        affected_edges=affected_edges,
        message=f"Simulated {rainfall_mm_hr} mm/hr rainfall",
    )


@app.get("/api/v1/routing/navigate", response_model=RouteResponse)
def get_optimal_route(
    start_node: Annotated[int, Query(description="Origin node id")],
    target_node: Annotated[int, Query(description="Destination node id")],
    clearance_cm: Annotated[
        float, Query(gt=0, le=200, description="Vehicle clearance in cm")
    ] = settings.default_clearance_cm,
    db: Session = Depends(get_db),
):
    """
    Run the Time-Dependent A* search and return the route as a GeoJSON
    LineString plus the per-edge segments it traverses.

    Returns 404 when no route is passable for the given clearance.
    """
    nodes, edges, states = _load_graph(db)
    _require_node(nodes, start_node, "start_node")
    _require_node(nodes, target_node, "target_node")

    graph_nodes: dict[int, tuple[float, float]] = {
        node_id: (node.latitude, node.longitude) for node_id, node in nodes.items()
    }

    # Roads are treated as bidirectional: a flooded evacuation corridor is
    # usable in both directions, and a one-way seed made reverse trips 404.
    graph_edges: dict[int, list[tuple[int, float, float, float]]] = {}
    pair_index: dict[tuple[int, int], models.RoadEdge] = {}

    for edge in edges:
        state = states.get(edge.edge_id)
        water_cm = float(state.water_depth_cm) if state else 0.0
        pair = (
            min(edge.start_node_id, edge.end_node_id),
            max(edge.start_node_id, edge.end_node_id),
        )
        pair_index[pair] = edge

        for origin, destination in (
            (edge.start_node_id, edge.end_node_id),
            (edge.end_node_id, edge.start_node_id),
        ):
            graph_edges.setdefault(origin, []).append(
                (destination, edge.distance_meters, edge.max_speed_kmh, water_cm)
            )

    path, travel_time_s = td_a_star_search(
        graph_nodes,
        graph_edges,
        start_node,
        target_node,
        vehicle_clearance_cm=clearance_cm,
    )

    if not path:
        raise HTTPException(
            status_code=404,
            detail="No safe route available under current flood conditions.",
        )

    geometry_map = _load_edge_geometry(db)

    coordinates: list[list[float]] = []
    segments: list[RouteSegment] = []

    if len(path) == 1:
        # Origin equals destination: emit a degenerate but valid LineString.
        origin = nodes[path[0]]
        point = [origin.longitude, origin.latitude]
        coordinates = [point, point]
    else:
        for origin_id, destination_id in zip(path, path[1:], strict=False):
            edge = pair_index.get((min(origin_id, destination_id), max(origin_id, destination_id)))

            if edge is None:
                hop_coordinates = _straight_line(nodes[origin_id], nodes[destination_id])
            else:
                hop_coordinates = _edge_coordinates(
                    geometry_map.get(edge.edge_id),
                    nodes[edge.start_node_id],
                    nodes[edge.end_node_id],
                )
                # Orient the stored geometry along the direction of travel.
                if edge.start_node_id != origin_id:
                    hop_coordinates = list(reversed(hop_coordinates))

                state = states.get(edge.edge_id)
                water_cm = float(state.water_depth_cm) if state else 0.0
                segments.append(
                    RouteSegment(
                        edge_id=edge.edge_id,
                        start_node_id=origin_id,
                        end_node_id=destination_id,
                        water_depth_cm=round(water_cm, 2),
                        status=classify_passability(water_cm, clearance_cm),
                    )
                )

            if not coordinates:
                coordinates = list(hop_coordinates)
            elif coordinates[-1] == hop_coordinates[0]:
                coordinates.extend(hop_coordinates[1:])
            else:
                coordinates.extend(hop_coordinates)

    return RouteResponse(
        start_node=start_node,
        target_node=target_node,
        vehicle_clearance_cm=clearance_cm,
        optimal_path_nodes=path,
        geometry={"type": "LineString", "coordinates": coordinates},
        segments=segments,
        estimated_travel_time_minutes=round(travel_time_s / 60.0, 2),
    )
