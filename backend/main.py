import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from config import settings
from database import get_db
from geometry import backfill_geometry
from hydrology import calculate_scs_cn_runoff, compute_node_water_depth
from routing import classify_passability, td_a_star_search
from schemas import (
    AssignRequest,
    ConfirmRequest,
    EdgeFeature,
    EdgeFeatureCollection,
    EdgeProperties,
    HazardCreate,
    HazardResponse,
    HazardUpdate,
    NetworkStateResponse,
    NodeFeature,
    NodeFeatureCollection,
    NodeProperties,
    RouteResponse,
    RouteSegment,
    SimulationResponse,
    SOSCreate,
    SOSResponse,
    VehicleCreate,
    VehicleResponse,
    VehicleUpdate,
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
    # The schema is owned by Alembic (backend/migrations), not create_all:
    # create_all can create missing tables but never alter existing ones, which
    # would drift from the migration history applied to Supabase. The container
    # entrypoint and CI run `alembic upgrade head` before this starts.
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


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Attach baseline security headers to every response.

    ``X-Content-Type-Options: nosniff`` stops browsers from MIME-sniffing JSON
    into an executable type. ``Cross-Origin-Resource-Policy: cross-origin`` is
    deliberate rather than ``same-origin``: this API is consumed by the Next.js
    LGU dashboard and the React Native driver app from origins we do not
    control, and ``same-origin`` would make no-cors loads of API responses fail.
    Both are flagged by OWASP ZAP when absent, so the security scan depends on
    this middleware.
    """
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Cross-Origin-Resource-Policy", "cross-origin")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    return response


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


# ---------------------------------------------------------------------------
# SOS / Hazards / Vehicles / Dispatch endpoints
# ---------------------------------------------------------------------------


@app.post("/api/v1/sos", response_model=SOSResponse)
def create_sos(sos: SOSCreate, db: Session = Depends(get_db)):
    import models

    # Create a simple auto-incrementing id by getting max
    max_id = db.query(func.max(models.SOSRequest.sos_id)).scalar() or 0
    new_sos = models.SOSRequest(
        sos_id=int(max_id) + 1,
        latitude=sos.latitude,
        longitude=sos.longitude,
        note=sos.note,
        status="pending",
    )
    db.add(new_sos)
    db.commit()
    db.refresh(new_sos)
    return new_sos


@app.post("/api/v1/hazards", response_model=HazardResponse)
def create_hazard(hazard: HazardCreate, db: Session = Depends(get_db)):
    import models

    max_id = db.query(func.max(models.HazardZone.hazard_id)).scalar() or 0
    new_hazard = models.HazardZone(
        hazard_id=int(max_id) + 1,
        name=hazard.name,
        obstruction_level=hazard.obstruction_level,
        avg_depth_cm=hazard.avg_depth_cm,
        edge_id=hazard.edge_id,
        notes=hazard.notes,
        active=True,
    )
    db.add(new_hazard)
    db.commit()
    db.refresh(new_hazard)
    return new_hazard


@app.patch("/api/v1/hazards/{hazard_id}", response_model=HazardResponse)
def update_hazard(hazard_id: int, hazard: HazardUpdate, db: Session = Depends(get_db)):
    import models

    db_hazard = db.query(models.HazardZone).filter(models.HazardZone.hazard_id == hazard_id).first()
    if not db_hazard:
        raise HTTPException(status_code=404, detail="Hazard not found")
    if hazard.name is not None:
        db_hazard.name = hazard.name
    if hazard.obstruction_level is not None:
        db_hazard.obstruction_level = hazard.obstruction_level
    if hazard.avg_depth_cm is not None:
        db_hazard.avg_depth_cm = hazard.avg_depth_cm
    if hazard.active is not None:
        db_hazard.active = hazard.active
    if hazard.notes is not None:
        db_hazard.notes = hazard.notes
    db.commit()
    db.refresh(db_hazard)
    return db_hazard


@app.post("/api/v1/hazards/{hazard_id}/publish", response_model=HazardResponse)
def publish_hazard(hazard_id: int, db: Session = Depends(get_db)):
    import models

    db_hazard = db.query(models.HazardZone).filter(models.HazardZone.hazard_id == hazard_id).first()
    if not db_hazard:
        raise HTTPException(status_code=404, detail="Hazard not found")
    db_hazard.published_at = datetime.now(UTC).replace(tzinfo=None)
    db_hazard.active = True
    db.commit()
    db.refresh(db_hazard)
    return db_hazard


@app.post("/api/v1/sos/{sos_id}/assign", response_model=SOSResponse)
def assign_sos(sos_id: int, assign_req: AssignRequest, db: Session = Depends(get_db)):
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")
    db_vehicle = (
        db.query(models.Vehicle).filter(models.Vehicle.vehicle_id == assign_req.vehicle_id).first()
    )
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db_sos.vehicle_id = assign_req.vehicle_id
    db_sos.status = "assigned"
    db.commit()
    db.refresh(db_sos)
    return db_sos


@app.post("/api/v1/dispatch/{sos_id}/confirm", response_model=SOSResponse)
def confirm_dispatch(sos_id: int, confirm_req: ConfirmRequest, db: Session = Depends(get_db)):
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")
    if confirm_req.note:
        if db_sos.note:
            db_sos.note = f"{db_sos.note}; {confirm_req.note}"
        else:
            db_sos.note = confirm_req.note
    db_sos.status = "confirmed"
    db.commit()
    db.refresh(db_sos)
    return db_sos


@app.get("/api/v1/vehicles", response_model=list[VehicleResponse])
def list_vehicles(db: Session = Depends(get_db)):
    import models

    return db.query(models.Vehicle).all()


@app.post("/api/v1/vehicles", response_model=VehicleResponse)
def create_vehicle(vehicle: VehicleCreate, db: Session = Depends(get_db)):
    import models

    max_id = db.query(func.max(models.Vehicle.vehicle_id)).scalar() or 0
    new_vehicle = models.Vehicle(
        vehicle_id=int(max_id) + 1,
        call_sign=vehicle.call_sign,
        vehicle_type=vehicle.vehicle_type,
        clearance_cm=vehicle.clearance_cm,
        status=vehicle.status,
        current_location_lat=vehicle.current_location_lat,
        current_location_lon=vehicle.current_location_lon,
    )
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle


@app.patch("/api/v1/vehicles/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(vehicle_id: int, vehicle: VehicleUpdate, db: Session = Depends(get_db)):
    import models

    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.vehicle_id == vehicle_id).first()
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    for field, value in vehicle.model_dump(exclude_unset=True).items():
        setattr(db_vehicle, field, value)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle
