import json
from collections.abc import Callable
from contextlib import asynccontextmanager
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from uuid import UUID, uuid4

import bcrypt
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from geoalchemy2 import Geography
from sqlalchemy import cast, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, defer

import audit
import events
import flood_state
import models
import network_seed
import reports
from auth_utils import get_current_user, require_roles
from config import settings
from database import SessionLocal, get_db
from geometry import backfill_geometry
from hydrology import calculate_scs_cn_runoff, compute_node_water_depth
from rate_limit import prune as prune_rate_limits
from rate_limit import rate_limit
from routing import build_instructions, classify_passability, hazard_blocks, td_a_star_search
from schemas import (
    AssignRequest,
    AuditResponse,
    AuditVerifyResponse,
    ConfirmRequest,
    DispatchPreviewResponse,
    DispatchPreviewUnit,
    EdgeFeature,
    EdgeFeatureCollection,
    EdgeProperties,
    FloodStateEdge,
    FloodStateResponse,
    HazardCreate,
    HazardResponse,
    HazardUpdate,
    IncidentLogItem,
    LoginRequest,
    NearestSensorReading,
    NetworkStateResponse,
    NodeFeature,
    NodeFeatureCollection,
    NodeProperties,
    RegisterRequest,
    ReportApproveRequest,
    ReportEscalateRequest,
    ReportHoldRequest,
    ReportNoteRequest,
    ReportPhotoInfo,
    ReportRejectRequest,
    ReportResponse,
    RouteHazard,
    RouteInstruction,
    RouteResponse,
    RouteSegment,
    SendVerifyRequest,
    SensorCreateRequest,
    SensorReadingRequest,
    SensorReadingResponse,
    SensorResponse,
    SensorUpdateRequest,
    SimulationResponse,
    SOSActionRequest,
    SOSCreate,
    SOSEscalateRequest,
    SOSNoteRequest,
    SOSResponse,
    TelemetryPing,
    TokenResponse,
    UserCreateRequest,
    UserResponse,
    UserUpdateRequest,
    VehicleCreate,
    VehicleResponse,
    VehicleUpdate,
    VerifyRequest,
    geometry_to_geojson,
)

# ---------------------------------------------------------------------------
# Seeding + geometry backfill
# ---------------------------------------------------------------------------


# Portal roles and field roles are separate: a driver account is authenticated
# but never privileged, so the two sets are kept explicit.
ADMIN_ROLES = {"LGU_DISPATCHER", "SUPER_ADMIN"}
DRIVER_ROLES = {"EMERGENCY_DRIVER"}
ALLOWED_ROLES = ADMIN_ROLES | DRIVER_ROLES

# Route-level enforcement (TSD LIM-022). Every /api/v1 route requires a token
# except the four auth entry points; writes are further limited to portal roles,
# because a driver account is authenticated but never privileged.
require_user = get_current_user
require_admin = require_roles(*ADMIN_ROLES)


def seed_database(db: Session) -> None:
    """Seed the Pasig / Taguig corridor network on first boot (TSD LIM-014).

    The graph itself lives in ``network_seed`` so the same data seeds a fresh
    database and can be re-applied to an existing one with
    ``python network_seed.py``.
    """
    if db.query(models.RoadNode).count() > 0:
        return

    counts = network_seed.apply(db)
    print(
        f"[startup] seeded road network: {counts['nodes_created']} nodes, "
        f"{counts['edges_created']} edges"
    )


def seed_dispatcher_account(db: Session) -> None:
    """Provision or ensure the bootstrap LGU dispatcher account exists with SUPER_ADMIN privileges.

    Registration only ever creates driver accounts, so the LGU dispatcher
    has to come from configuration. If the account already exists, ensure it
    holds the SUPER_ADMIN role so configured administrators can access
    privileged portal and simulation functions.
    """
    admin_email = settings.admin_email.strip().lower()
    existing = db.query(models.User).filter(models.User.email == admin_email).first()
    if existing:
        if existing.role != "SUPER_ADMIN":
            existing.role = "SUPER_ADMIN"
            db.commit()
            print(f"[startup] promoted dispatcher account {admin_email} to SUPER_ADMIN")
        return

    password_hash = bcrypt.hashpw(settings.admin_password.encode("utf-8"), bcrypt.gensalt()).decode(
        "utf-8"
    )
    db.add(
        models.User(
            name="LGU Dispatcher",
            email=admin_email,
            password_hash=password_hash,
            role="SUPER_ADMIN",
        )
    )
    db.commit()
    print(f"[startup] provisioned dispatcher account {admin_email}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # The schema is owned by Alembic (backend/migrations), not create_all:
    # create_all can create missing tables but never alter existing ones, which
    # would drift from the migration history applied to Supabase. The container
    # entrypoint and CI run `alembic upgrade head` before this starts.
    db = next(get_db())
    try:
        # Demo nodes and edges exist so a fresh development database renders a
        # map. A real deployment supplies its own network data, so FASTAPI_ENV
        # gates the seed (TSD §4.1). The bootstrap dispatcher is still created,
        # because registration cannot mint an administrative role.
        if settings.is_development:
            seed_database(db)
        seed_dispatcher_account(db)
        result = backfill_geometry(db)
        print(
            f"[startup] geometry backfill: {result['nodes_updated']} nodes, "
            f"{result['edges_updated']} edges populated"
        )
        # Dead rate-limit windows are inert once their window has passed. Doing
        # this at startup rather than on a schedule keeps the deployment free of
        # background jobs; a cold start is frequent enough on the host.
        try:
            pruned = prune_rate_limits(db)
            if pruned:
                print(f"[startup] pruned {pruned} expired rate-limit windows")
        except SQLAlchemyError:
            # The table arrives with the migration; a database that has not been
            # upgraded yet must not stop the API from booting.
            print("[startup] rate-limit cleanup skipped: table unavailable")
    finally:
        db.close()
    yield


app = FastAPI(
    title="MetroFlow Core API Engine",
    description="Intelligent Urban Mobility & Flood Simulation System",
    version="1.0.0",
    lifespan=lifespan,
    # Interactive docs are a development aid; production serves the schema to
    # clients but no Swagger or ReDoc UI (TSD §4.1).
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url="/openapi.json",
)

# CORS for the Next.js portal. The Expo app is native and sends no Origin, so it
# is unaffected by this list. credentials are only advertised for an explicit
# allowlist: a wildcard and credentials cannot be combined safely (TSD SEC-002).
_cors_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials="*" not in _cors_origins,
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


def _load_hazard_coverage(
    db: Session,
) -> tuple[list[models.HazardZone], dict[int, set[int]]]:
    """Active hazards and the road edges each one covers (TSD §2.6).

    A hazard covers an edge when its polygon intersects the edge geometry, or
    when a closure hazard points at the edge directly. Both sources are unioned
    so a closure drawn without geometry still reroutes traffic. The router and
    the route-hazard report read this one mapping, which is what keeps their
    idea of "blocks" identical.
    """
    hazards = db.query(models.HazardZone).filter(models.HazardZone.active.is_(True)).all()
    covered: dict[int, set[int]] = {hazard.hazard_id: set() for hazard in hazards}
    if not hazards:
        return hazards, covered

    rows = (
        db.query(models.HazardZone.hazard_id, models.RoadEdge.edge_id)
        .select_from(models.HazardZone)
        .join(
            models.RoadEdge,
            func.ST_Intersects(models.RoadEdge.geom, models.HazardZone.geometry),
        )
        .filter(models.HazardZone.active.is_(True))
        .all()
    )
    for hazard_id, edge_id in rows:
        covered.setdefault(hazard_id, set()).add(edge_id)

    for hazard in hazards:
        if hazard.edge_id is not None:
            covered[hazard.hazard_id].add(hazard.edge_id)

    return hazards, covered


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
                    road_name=edge.road_name,
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


def _nearest_node(nodes: dict[int, models.RoadNode], latitude: float, longitude: float) -> int:
    """Snap a coordinate onto the closest road node, which is how a unit joins the graph."""
    return min(
        nodes,
        key=lambda node_id: reports.haversine_m(
            latitude, longitude, nodes[node_id].latitude, nodes[node_id].longitude
        ),
    )


def _release_vehicle(db: Session, vehicle_id: int) -> None:
    """Return a dispatched unit to the available pool (FSD-BRULE-011).

    A unit taken out of service meanwhile stays out of service.
    """
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.vehicle_id == vehicle_id).first()
    if vehicle and (vehicle.status or "").upper() == "DISPATCHED":
        vehicle.status = "AVAILABLE"


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
    _user: models.User = Depends(require_user),
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


@app.post(
    "/api/v1/simulation/rain",
    response_model=SimulationResponse,
    dependencies=[Depends(rate_limit("simulation", settings.rate_limit_simulation_per_min))],
)
def trigger_rainfall_simulation(
    rainfall_mm_hr: Annotated[float, Query(ge=0, le=250, description="Rainfall intensity (mm/hr)")],
    clearance_cm: Annotated[
        float, Query(gt=0, le=200, description="Vehicle clearance in cm")
    ] = settings.default_clearance_cm,
    _user: models.User = Depends(require_admin),
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

    audit.record(
        db,
        user=_user,
        action_type=audit.SIMULATION_RAIN,
        payload={
            "rainfall_mm_hr": rainfall_mm_hr,
            "clearance_cm": clearance_cm,
            "runoff_mm": round(runoff_mm, 4),
            "affected_edges": affected_edges,
        },
    )
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
    ignore_hazards: Annotated[
        bool,
        Query(
            description=(
                "Plan through verified hazards anyway. Only for the explicitly "
                "unsafe alternative offered when no safe route exists."
            )
        ),
    ] = False,
    _user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Run the Time-Dependent A* search and return the route as a GeoJSON
    LineString plus per-edge segments, turn-by-turn instructions and the
    verified hazards that touch the route.

    Active hazards whose obstruction level blocks the vehicle are excluded
    from the graph unless ``ignore_hazards`` is set (TSD §2.6). Returns 404
    when no route is passable for the given clearance.
    """
    nodes, edges, states = _load_graph(db)
    _require_node(nodes, start_node, "start_node")
    _require_node(nodes, target_node, "target_node")

    hazards, hazard_edges = _load_hazard_coverage(db)
    blocked_edges: set[int] = set()
    if not ignore_hazards:
        for hazard in hazards:
            if hazard_blocks(hazard.obstruction_level):
                blocked_edges |= hazard_edges.get(hazard.hazard_id, set())

    graph_nodes: dict[int, tuple[float, float]] = {
        node_id: (node.latitude, node.longitude) for node_id, node in nodes.items()
    }

    # Roads are treated as bidirectional: a flooded evacuation corridor is
    # usable in both directions, and a one-way seed made reverse trips 404.
    graph_edges: dict[int, list[tuple[int, float, float, float]]] = {}
    pair_index: dict[tuple[int, int], models.RoadEdge] = {}

    for edge in edges:
        if edge.edge_id in blocked_edges:
            continue

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
    hops: list[tuple[int, int, float, str | None]] = []
    traversed_edges: set[int] = set()

    if len(path) == 1:
        # Origin equals destination: emit a degenerate but valid LineString.
        origin = nodes[path[0]]
        point = [origin.longitude, origin.latitude]
        coordinates = [point, point]
    else:
        for origin_id, destination_id in zip(path, path[1:], strict=False):
            edge = pair_index.get((min(origin_id, destination_id), max(origin_id, destination_id)))
            hop_distance = 0.0
            hop_road_name: str | None = None

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

                hop_distance = float(edge.distance_meters)
                hop_road_name = edge.road_name
                traversed_edges.add(edge.edge_id)

                state = states.get(edge.edge_id)
                water_cm = float(state.water_depth_cm) if state else 0.0
                segments.append(
                    RouteSegment(
                        edge_id=edge.edge_id,
                        start_node_id=origin_id,
                        end_node_id=destination_id,
                        road_name=edge.road_name,
                        distance_m=round(hop_distance, 2),
                        water_depth_cm=round(water_cm, 2),
                        status=classify_passability(water_cm, clearance_cm),
                    )
                )

            hops.append((origin_id, destination_id, hop_distance, hop_road_name))

            if not coordinates:
                coordinates = list(hop_coordinates)
            elif coordinates[-1] == hop_coordinates[0]:
                coordinates.extend(hop_coordinates[1:])
            else:
                coordinates.extend(hop_coordinates)

    instructions = [
        RouteInstruction(**asdict(step))
        for step in build_instructions(
            path,
            hops,
            graph_nodes,
            {node_id: node.name for node_id, node in nodes.items()},
        )
    ]

    # Every active hazard touching a traversed edge is reported, blocking or
    # not: a CAUTION crossing is exactly what the proximity alert is for
    # (FSD-FR-063), and an unsafe alternative must still disclose what it
    # crosses.
    route_hazards = [
        RouteHazard(
            hazard_id=hazard.hazard_id,
            name=hazard.name,
            obstruction_level=hazard.obstruction_level,
            avg_depth_cm=hazard.avg_depth_cm,
            edge_id=hazard.edge_id,
            blocking=hazard_blocks(hazard.obstruction_level),
            geometry=geometry_to_geojson(hazard.geometry),
            warning_radius_m=settings.warning_radius_m,
        )
        for hazard in sorted(hazards, key=lambda row: row.hazard_id)
        if hazard_edges.get(hazard.hazard_id, set()) & traversed_edges
    ]

    return RouteResponse(
        start_node=start_node,
        target_node=target_node,
        destination_name=nodes[target_node].name,
        vehicle_clearance_cm=clearance_cm,
        optimal_path_nodes=path,
        geometry={"type": "LineString", "coordinates": coordinates},
        segments=segments,
        instructions=instructions,
        hazards=route_hazards,
        total_distance_m=round(sum(hop[2] for hop in hops), 2),
        estimated_travel_time_minutes=round(travel_time_s / 60.0, 2),
    )


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@app.post(
    "/api/v1/auth/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit("login", settings.rate_limit_login_per_min))],
)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    import models
    from auth_utils import create_access_token

    email = request.email.strip().lower()
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    try:
        password_ok = bcrypt.checkpw(
            request.password.encode("utf-8"), user.password_hash.encode("utf-8")
        )
    except ValueError:
        # A malformed stored hash must not distinguish itself from a wrong password.
        password_ok = False
    if not password_ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=403, detail="This account is not permitted to use MetroFlow"
        )
    token = create_access_token({"sub": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "user_id": user.user_id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


@app.get("/api/v1/auth/me", response_model=UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    """Return the account behind the presented bearer token."""
    return {
        "user_id": current_user.user_id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
    }


@app.post(
    "/api/v1/auth/send-verification",
    dependencies=[Depends(rate_limit("send-verification", settings.rate_limit_register_per_min))],
)
def send_verification(request: SendVerifyRequest):
    try:
        from verification_store import create_code
    except Exception:
        import verification_store

        create_code = verification_store.create_code
    code = create_code(request.email)
    # There is no mail transport yet, so the code is only ever returned in
    # development and test. Production answers without it rather than leaking a
    # usable code to the caller.
    if settings.is_production:
        return {"message": "Verification code sent to email"}
    return {"message": "Verification code sent", "code": code}


@app.post(
    "/api/v1/auth/verify",
    dependencies=[Depends(rate_limit("verify", settings.rate_limit_register_per_min))],
)
def verify(request: VerifyRequest):
    try:
        from verification_store import verify_code
    except Exception:
        import verification_store

        verify_code = verification_store.verify_code
    ok = verify_code(request.email, request.code)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    return {"verified": True}


@app.post(
    "/api/v1/auth/register",
    response_model=UserResponse,
    status_code=201,
    dependencies=[Depends(rate_limit("register", settings.rate_limit_register_per_min))],
)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Create a driver account.

    The portal's dispatcher accounts are provisioned by the LGU, so this endpoint
    deliberately refuses to mint an administrative role. Drivers and commuters
    self-register and get the same non-privileged role.
    """
    import models

    name = request.name.strip()
    email = request.email.strip().lower()
    if not name:
        raise HTTPException(status_code=422, detail="Name is required")
    if "@" not in email or "." not in email.split("@", 1)[1]:
        raise HTTPException(status_code=422, detail="A valid email address is required")
    if len(request.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    role = (request.role or "EMERGENCY_DRIVER").strip().upper()
    if role in {"DRIVER", "COMMUTER"}:
        role = "EMERGENCY_DRIVER"
    if role in ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Dispatcher accounts are provisioned by the LGU, not self-registered",
        )
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=422, detail="Unknown role")

    existing = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    if request.verification_code:
        from verification_store import verify_code

        if not verify_code(email, request.verification_code):
            raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    user = models.User(
        name=name,
        email=email,
        password_hash=bcrypt.hashpw(request.password.encode("utf-8"), bcrypt.gensalt()).decode(
            "utf-8"
        ),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


# ---------------------------------------------------------------------------
# User management endpoints (FSD-FR-048)
# ---------------------------------------------------------------------------


@app.get("/api/v1/users", response_model=list[UserResponse])
def list_users(
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users (FSD-FR-048). Admin only."""
    import models

    users = db.query(models.User).order_by(models.User.user_id).all()
    return users


@app.post("/api/v1/users", response_model=UserResponse, status_code=201)
def create_user(
    user_req: UserCreateRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new user (FSD-FR-048). Admin only, audited."""
    import models

    # Validate role
    if user_req.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role. Allowed: {', '.join(sorted(ALLOWED_ROLES))}",
        )

    # Check email uniqueness
    email = user_req.email.strip().lower()
    existing = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    # Create user
    max_id = db.query(func.max(models.User.user_id)).scalar() or 0
    new_user = models.User(
        user_id=int(max_id) + 1,
        name=user_req.name.strip(),
        email=email,
        password_hash=bcrypt.hashpw(user_req.password.encode("utf-8"), bcrypt.gensalt()).decode(
            "utf-8"
        ),
        role=user_req.role,
    )
    db.add(new_user)
    audit.record(
        db,
        user=_user,
        action_type=audit.USER_CREATE,
        payload={
            "user_id": new_user.user_id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role,
            "actor": _user.name or _user.email,
        },
    )
    db.commit()
    db.refresh(new_user)
    return new_user


@app.patch("/api/v1/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_req: UserUpdateRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update an existing user (FSD-FR-048). Admin only, audited."""
    import models

    db_user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-escalation or self-deletion
    if db_user.user_id == _user.user_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot modify your own account through this endpoint",
        )

    changes = user_req.model_dump(exclude_unset=True, exclude_none=True)

    # Validate role if provided
    if "role" in changes and changes["role"] not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role. Allowed: {', '.join(sorted(ALLOWED_ROLES))}",
        )

    # Check email uniqueness if being changed
    if "email" in changes:
        email = changes["email"].strip().lower()
        existing = (
            db.query(models.User)
            .filter(func.lower(models.User.email) == email, models.User.user_id != user_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        changes["email"] = email

    if "name" in changes:
        changes["name"] = changes["name"].strip()

    # Apply changes
    for field, value in changes.items():
        setattr(db_user, field, value)

    audit.record(
        db,
        user=_user,
        action_type=audit.USER_UPDATE,
        payload={
            "user_id": user_id,
            "changed": changes,
            "actor": _user.name or _user.email,
        },
    )
    db.commit()
    db.refresh(db_user)
    return db_user


@app.delete("/api/v1/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a user (FSD-FR-048). Admin only, audited."""
    import models

    db_user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deletion
    if db_user.user_id == _user.user_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot delete your own account",
        )

    # Prevent deleting the last admin
    admin_count = db.query(models.User).filter(models.User.role.in_(ADMIN_ROLES)).count()
    if db_user.role in ADMIN_ROLES and admin_count <= 1:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete the last administrator account",
        )

    audit.record(
        db,
        user=_user,
        action_type=audit.USER_DELETE,
        payload={
            "user_id": user_id,
            "name": db_user.name,
            "email": db_user.email,
            "role": db_user.role,
            "actor": _user.name or _user.email,
        },
    )
    db.delete(db_user)
    db.commit()


# ---------------------------------------------------------------------------
# SOS / Hazards / Vehicles / Dispatch endpoints
# ---------------------------------------------------------------------------


@app.post(
    "/api/v1/sos",
    response_model=SOSResponse,
    dependencies=[Depends(rate_limit("sos", settings.rate_limit_sos_per_min))],
)
def create_sos(
    sos: SOSCreate,
    _user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
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
    # Events are emitted inside the transaction that changes the row: the relay
    # can then never show an SOS that rolled back (ADR-024).
    db.flush()
    events.emit(
        db, channel=events.SOS, event_type=events.SOS_CREATED, payload=events.sos_payload(new_sos)
    )
    db.commit()
    db.refresh(new_sos)
    return new_sos


@app.post("/api/v1/hazards", response_model=HazardResponse)
def create_hazard(
    hazard: HazardCreate,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
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
    db.flush()
    audit.record(
        db,
        user=_user,
        action_type=audit.HAZARD_CREATE,
        payload={
            "hazard_id": new_hazard.hazard_id,
            "name": new_hazard.name,
            "obstruction_level": new_hazard.obstruction_level,
            "avg_depth_cm": new_hazard.avg_depth_cm,
            "edge_id": new_hazard.edge_id,
        },
    )
    events.emit(
        db,
        channel=events.HAZARD,
        event_type=events.HAZARD_CREATED,
        payload=events.hazard_payload(new_hazard),
    )
    db.commit()
    db.refresh(new_hazard)
    return new_hazard


@app.patch("/api/v1/hazards/{hazard_id}", response_model=HazardResponse)
def update_hazard(
    hazard_id: int,
    hazard: HazardUpdate,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    import models

    db_hazard = db.query(models.HazardZone).filter(models.HazardZone.hazard_id == hazard_id).first()
    if not db_hazard:
        raise HTTPException(status_code=404, detail="Hazard not found")
    changes = hazard.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        setattr(db_hazard, field, value)
    if changes:
        audit.record(
            db,
            user=_user,
            action_type=audit.HAZARD_UPDATE,
            payload={"hazard_id": hazard_id, "changed": changes},
        )
        # Flush first so the payload carries the new updated_at, not the old one.
        db.flush()
        events.emit(
            db,
            channel=events.HAZARD,
            event_type=events.HAZARD_UPDATED,
            payload=events.hazard_payload(db_hazard),
        )
    db.commit()
    db.refresh(db_hazard)
    return db_hazard


@app.post("/api/v1/hazards/{hazard_id}/publish", response_model=HazardResponse)
def publish_hazard(
    hazard_id: int,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    import models

    db_hazard = db.query(models.HazardZone).filter(models.HazardZone.hazard_id == hazard_id).first()
    if not db_hazard:
        raise HTTPException(status_code=404, detail="Hazard not found")
    db_hazard.published_at = datetime.now(UTC).replace(tzinfo=None)
    db_hazard.active = True
    audit.record(
        db,
        user=_user,
        action_type=audit.HAZARD_PUBLISH,
        payload={
            "hazard_id": db_hazard.hazard_id,
            "obstruction_level": db_hazard.obstruction_level,
            "edge_id": db_hazard.edge_id,
        },
    )
    # Publication is the event drivers care about: it is what puts the hazard on
    # their map, so it is its own event type rather than a generic update.
    db.flush()
    events.emit(
        db,
        channel=events.HAZARD,
        event_type=events.HAZARD_PUBLISHED,
        payload=events.hazard_payload(db_hazard),
    )
    db.commit()
    db.refresh(db_hazard)
    return db_hazard


@app.get("/api/v1/dispatch/{sos_id}/preview", response_model=DispatchPreviewResponse)
def preview_dispatch_route(
    sos_id: int,
    vehicle_id: Annotated[
        int | None, Query(description="Optional specific vehicle to preview")
    ] = None,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Rank available units by flood-safe travel time to an incident (FSD-FR-088, FSD-FR-089).

    If ``vehicle_id`` is provided, only that unit is previewed. Otherwise all
    available units are ranked.

    Read-only: the assignment is committed by ``/assign`` and ``/confirm``. A unit
    with no position or no safe route is reported with a reason rather than
    dropped, so the dispatcher can still assign it without a preview.
    """
    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")

    # BRULE-011: only an available unit is assignable, so only those are ranked.
    query = db.query(models.Vehicle).filter(func.upper(models.Vehicle.status) == "AVAILABLE")
    if vehicle_id is not None:
        query = query.filter(models.Vehicle.vehicle_id == vehicle_id)
    available = query.order_by(models.Vehicle.vehicle_id).all()

    if not available:
        if vehicle_id is not None:
            raise HTTPException(status_code=404, detail="Vehicle not found or not available")
        # Return empty list when no units available but vehicle_id not specified
        return DispatchPreviewResponse(sos_id=db_sos.sos_id, units=[])

    nodes, _, _ = _load_graph(db)
    if not nodes:
        raise HTTPException(status_code=503, detail="Road network is not available")
    target_node = _nearest_node(nodes, db_sos.latitude, db_sos.longitude)

    units: list[DispatchPreviewUnit] = []
    for vehicle in available:
        unit = DispatchPreviewUnit(vehicle_id=vehicle.vehicle_id, call_sign=vehicle.call_sign)
        if vehicle.current_location_lat is None or vehicle.current_location_lon is None:
            if vehicle_id is not None:
                # When specific vehicle requested, return 409 for missing position
                raise HTTPException(
                    status_code=409,
                    detail=f"{vehicle.call_sign} has no current position. Assignment can proceed without a preview.",
                )
            unit.detail = "No current position; assignment can proceed without a preview."
            units.append(unit)
            continue
        try:
            route = get_optimal_route(
                start_node=_nearest_node(
                    nodes, vehicle.current_location_lat, vehicle.current_location_lon
                ),
                target_node=target_node,
                clearance_cm=float(vehicle.clearance_cm or settings.default_clearance_cm),
                ignore_hazards=False,
                _user=_user,
                db=db,
            )
        except HTTPException as exc:
            if vehicle_id is not None:
                # When specific vehicle requested, return 422 for no safe route
                raise HTTPException(
                    status_code=422,
                    detail=f"No safe route available for {vehicle.call_sign}: {exc.detail}",
                ) from None
            unit.detail = str(exc.detail)
            units.append(unit)
            continue
        unit.total_distance_m = route.total_distance_m
        unit.estimated_travel_time_minutes = route.estimated_travel_time_minutes
        unit.destination_name = route.destination_name
        unit.hazards = route.hazards
        units.append(unit)

    units.sort(
        key=lambda unit: (
            unit.estimated_travel_time_minutes is None,
            unit.estimated_travel_time_minutes or 0.0,
        )
    )
    return DispatchPreviewResponse(sos_id=db_sos.sos_id, units=units)


@app.post("/api/v1/sos/{sos_id}/assign", response_model=SOSResponse)
def assign_sos(
    sos_id: int,
    assign_req: AssignRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")
    if db_sos.status in ("confirmed", "dispatched", "rejected"):
        raise HTTPException(
            status_code=409,
            detail=f"Incident cannot be assigned in its current state ({db_sos.status})",
        )
    db_vehicle = (
        db.query(models.Vehicle).filter(models.Vehicle.vehicle_id == assign_req.vehicle_id).first()
    )
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    # FSD-BRULE-011: only an available unit may be assigned; a second incident
    # must not double-book one already en route.
    if (db_vehicle.status or "").upper() != "AVAILABLE":
        raise HTTPException(
            status_code=409,
            detail=f"{db_vehicle.call_sign} is {db_vehicle.status}; only an available unit can be assigned",
        )
    if db_sos.vehicle_id and db_sos.vehicle_id != assign_req.vehicle_id:
        _release_vehicle(db, db_sos.vehicle_id)
    db_sos.vehicle_id = assign_req.vehicle_id
    db_sos.status = "assigned"
    db_vehicle.status = "DISPATCHED"
    audit.record(
        db,
        user=_user,
        action_type=audit.SOS_ASSIGN,
        payload={
            "sos_id": db_sos.sos_id,
            "vehicle_id": assign_req.vehicle_id,
            "call_sign": db_vehicle.call_sign,
            "actor": _user.name or _user.email,
        },
    )
    db.flush()
    events.emit(
        db, channel=events.SOS, event_type=events.SOS_UPDATED, payload=events.sos_payload(db_sos)
    )
    db.commit()
    db.refresh(db_sos)
    return db_sos


@app.post("/api/v1/dispatch/{sos_id}/confirm", response_model=SOSResponse)
def confirm_dispatch(
    sos_id: int,
    confirm_req: ConfirmRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")
    if db_sos.status in ("confirmed", "dispatched"):
        raise HTTPException(
            status_code=409,
            detail="Incident has already been dispatched",
        )
    if confirm_req.note:
        if db_sos.note:
            db_sos.note = f"{db_sos.note}; {confirm_req.note}"
        else:
            db_sos.note = confirm_req.note
    db_sos.status = "confirmed"
    audit.record(
        db,
        user=_user,
        action_type=audit.DISPATCH_CONFIRM,
        payload={
            "sos_id": db_sos.sos_id,
            "vehicle_id": db_sos.vehicle_id,
            "note": confirm_req.note,
            "actor": _user.name or _user.email,
        },
    )
    db.flush()
    events.emit(
        db, channel=events.SOS, event_type=events.SOS_UPDATED, payload=events.sos_payload(db_sos)
    )
    db.commit()
    db.refresh(db_sos)
    return db_sos


@app.post("/api/v1/dispatch/{sos_id}/undo", response_model=SOSResponse)
def undo_dispatch(
    sos_id: int,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Revert a recent dispatch action within the undo window (FSD-FR-045)."""
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")
    if db_sos.status != "confirmed":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot undo dispatch for incident in state '{db_sos.status}'",
        )
    prev_vehicle = db_sos.vehicle_id
    db_sos.status = "pending"
    db_sos.vehicle_id = None
    if prev_vehicle:
        _release_vehicle(db, prev_vehicle)
    audit.record(
        db,
        user=_user,
        action_type=audit.DISPATCH_UNDO,
        payload={
            "sos_id": db_sos.sos_id,
            "previous_vehicle_id": prev_vehicle,
            "actor": _user.name or _user.email,
        },
    )
    db.flush()
    events.emit(
        db, channel=events.SOS, event_type=events.SOS_UPDATED, payload=events.sos_payload(db_sos)
    )
    db.commit()
    db.refresh(db_sos)
    return db_sos


@app.post("/api/v1/sos/{sos_id}/reject", response_model=SOSResponse)
def reject_sos(
    sos_id: int,
    req: SOSActionRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Reject an SOS incident as a false alarm with a required reason (FSD-FR-039, FSD-FR-044)."""
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")
    if db_sos.status in ("confirmed", "dispatched"):
        raise HTTPException(status_code=409, detail="Cannot reject an already dispatched incident")
    if db_sos.vehicle_id:
        _release_vehicle(db, db_sos.vehicle_id)
    db_sos.status = "rejected"
    if db_sos.note:
        db_sos.note = f"{db_sos.note}; [REJECTED: {req.reason}]"
    else:
        db_sos.note = f"[REJECTED: {req.reason}]"
    audit.record(
        db,
        user=_user,
        action_type=audit.SOS_REJECT,
        payload={
            "sos_id": db_sos.sos_id,
            "reason": req.reason,
            "actor": _user.name or _user.email,
        },
    )
    db.flush()
    events.emit(
        db, channel=events.SOS, event_type=events.SOS_UPDATED, payload=events.sos_payload(db_sos)
    )
    db.commit()
    db.refresh(db_sos)
    return db_sos


@app.post("/api/v1/sos/{sos_id}/hold", response_model=SOSResponse)
def hold_sos(
    sos_id: int,
    req: SOSActionRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Hold an SOS incident pending sensor update with a required reason (FSD-FR-041, FSD-FR-044)."""
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")
    if db_sos.status in ("confirmed", "dispatched"):
        raise HTTPException(status_code=409, detail="Cannot hold an already dispatched incident")
    db_sos.status = "holding"
    if db_sos.note:
        db_sos.note = f"{db_sos.note}; [HELD: {req.reason}]"
    else:
        db_sos.note = f"[HELD: {req.reason}]"
    audit.record(
        db,
        user=_user,
        action_type=audit.SOS_HOLD,
        payload={
            "sos_id": db_sos.sos_id,
            "reason": req.reason,
            "actor": _user.name or _user.email,
        },
    )
    db.flush()
    events.emit(
        db, channel=events.SOS, event_type=events.SOS_UPDATED, payload=events.sos_payload(db_sos)
    )
    db.commit()
    db.refresh(db_sos)
    return db_sos


@app.post("/api/v1/sos/{sos_id}/escalate", response_model=SOSResponse)
def escalate_sos(
    sos_id: int,
    req: SOSEscalateRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Escalate an incident to BFP or Coast Guard with a required reason (FSD-FR-040, FSD-FR-044)."""
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")
    db_sos.status = "escalated"
    if db_sos.note:
        db_sos.note = f"{db_sos.note}; [ESCALATED TO {req.agency}: {req.reason}]"
    else:
        db_sos.note = f"[ESCALATED TO {req.agency}: {req.reason}]"
    audit.record(
        db,
        user=_user,
        action_type=audit.SOS_ESCALATE,
        payload={
            "sos_id": db_sos.sos_id,
            "agency": req.agency,
            "reason": req.reason,
            "actor": _user.name or _user.email,
        },
    )
    db.flush()
    events.emit(
        db, channel=events.SOS, event_type=events.SOS_UPDATED, payload=events.sos_payload(db_sos)
    )
    db.commit()
    db.refresh(db_sos)
    return db_sos


@app.post("/api/v1/sos/{sos_id}/notes", response_model=SOSResponse)
def add_sos_note(
    sos_id: int,
    req: SOSNoteRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Append an operational note to the SOS dispatch log (FSD-FR-037, FSD-FR-043)."""
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")
    if db_sos.note:
        db_sos.note = f"{db_sos.note}; {req.note}"
    else:
        db_sos.note = req.note
    audit.record(
        db,
        user=_user,
        action_type=audit.SOS_NOTE,
        payload={
            "sos_id": db_sos.sos_id,
            "note": req.note,
            "actor": _user.name or _user.email,
        },
    )
    db.flush()
    events.emit(
        db, channel=events.SOS, event_type=events.SOS_UPDATED, payload=events.sos_payload(db_sos)
    )
    db.commit()
    db.refresh(db_sos)
    return db_sos


@app.get("/api/v1/sos/{sos_id}/log", response_model=list[IncidentLogItem])
def get_sos_log(
    sos_id: int,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Chronological operations log for an SOS incident (FSD-FR-036, FSD-FR-043)."""
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS not found")

    items: list[IncidentLogItem] = []
    if db_sos.created_at:
        items.append(
            IncidentLogItem(
                log_id=0,
                time=db_sos.created_at.strftime("%I:%M %p"),
                created_at=db_sos.created_at,
                action_type="SOS_CREATED",
                actor_name="Citizen Beacon",
                text=f"Distress signal transmitted at ({db_sos.latitude:.4f}, {db_sos.longitude:.4f})",
                kind="muted",
            )
        )

    # Query audit logs matching sos_id
    rows = (
        db.query(models.AuditLog, models.User.name, models.User.email)
        .outerjoin(models.User, models.AuditLog.user_id == models.User.user_id)
        .filter(models.AuditLog.payload.like(f'%"sos_id":{sos_id}%'))
        .order_by(models.AuditLog.log_id.asc())
        .all()
    )

    for log_row, user_name, user_email in rows:
        actor = user_name or user_email or "Dispatch Officer"
        try:
            payload = json.loads(log_row.payload)
        except Exception:
            continue
        if payload.get("sos_id") != sos_id:
            continue

        time_str = log_row.created_at.strftime("%I:%M %p") if log_row.created_at else ""
        act = log_row.action_type
        if act == audit.SOS_NOTE:
            kind = "note"
            text = f"{payload.get('note')} (by {actor})"
        elif act == audit.SOS_ASSIGN:
            kind = "action"
            text = f"Assigned rescue unit {payload.get('call_sign', 'unit')} by {actor}"
        elif act == audit.DISPATCH_CONFIRM:
            kind = "action"
            text = f"Dispatched unit #{payload.get('vehicle_id')} by {actor}" + (
                f": {payload.get('note')}" if payload.get("note") else ""
            )
        elif act == audit.DISPATCH_UNDO:
            kind = "action"
            text = f"Dispatch reversed by {actor}"
        elif act == audit.SOS_REJECT:
            kind = "action"
            text = f"Rejected (False Alarm) by {actor}: {payload.get('reason')}"
        elif act == audit.SOS_HOLD:
            kind = "action"
            text = f"Held for sensor update by {actor}: {payload.get('reason')}"
        elif act == audit.SOS_ESCALATE:
            kind = "action"
            text = (
                f"Escalated to {payload.get('agency', 'BFP')} by {actor}: {payload.get('reason')}"
            )
        else:
            kind = "action"
            text = f"Action {act} recorded by {actor}"

        items.append(
            IncidentLogItem(
                log_id=log_row.log_id,
                time=time_str,
                created_at=log_row.created_at,
                action_type=act,
                actor_name=actor,
                text=text,
                kind=kind,
            )
        )

    return items


@app.get("/api/v1/vehicles", response_model=list[VehicleResponse])
def list_vehicles(
    _user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    import models

    return db.query(models.Vehicle).all()


@app.get("/api/v1/sos", response_model=list[SOSResponse])
def list_sos(
    status: str | None = None,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    import models

    query = db.query(models.SOSRequest)
    if status:
        query = query.filter(models.SOSRequest.status == status)
    return query.order_by(models.SOSRequest.created_at.desc()).all()


@app.get("/api/v1/hazards", response_model=list[HazardResponse])
def list_hazards(
    active: bool | None = None,
    _user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    import models

    query = db.query(models.HazardZone)
    if active is not None:
        query = query.filter(models.HazardZone.active == active)
    return query.order_by(models.HazardZone.created_at.desc()).all()


@app.post("/api/v1/vehicles", response_model=VehicleResponse)
def create_vehicle(
    vehicle: VehicleCreate,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
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
    db.flush()
    audit.record(
        db,
        user=_user,
        action_type=audit.VEHICLE_CREATE,
        payload={
            "vehicle_id": new_vehicle.vehicle_id,
            "call_sign": new_vehicle.call_sign,
            "vehicle_type": new_vehicle.vehicle_type,
            "clearance_cm": new_vehicle.clearance_cm,
            "status": new_vehicle.status,
        },
    )
    events.emit(
        db,
        channel=events.VEHICLE,
        event_type=events.VEHICLE_CREATED,
        payload=events.vehicle_payload(new_vehicle),
    )
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle


@app.patch("/api/v1/vehicles/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(
    vehicle_id: int,
    vehicle: VehicleUpdate,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    import models

    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.vehicle_id == vehicle_id).first()
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    changes = vehicle.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        setattr(db_vehicle, field, value)
    if changes:
        audit.record(
            db,
            user=_user,
            action_type=audit.VEHICLE_UPDATE,
            payload={"vehicle_id": vehicle_id, "changed": changes},
        )
        db.flush()
        events.emit(
            db,
            channel=events.VEHICLE,
            event_type=events.VEHICLE_UPDATED,
            payload=events.vehicle_payload(db_vehicle),
        )
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle


@app.post("/api/v1/vehicles/{vehicle_id}/telemetry", status_code=204)
def post_telemetry(
    vehicle_id: int,
    ping: TelemetryPing,
    _user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
) -> None:
    """Ingest one position/speed batch from the driver app (FSD-FR-072, VAL-020).

    Rejected with 429 if the same vehicle submitted a ping within
    ``settings.telemetry_min_seconds``.  On acceptance the vehicle row is
    updated in-place and a ``VEHICLE_UPDATED`` SSE event is emitted so the
    portal fleet overlay refreshes live (FSD-FR-074, FSD-FR-075).
    """
    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.vehicle_id == vehicle_id).first()
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    now = datetime.now(UTC).replace(tzinfo=None)
    if db_vehicle.current_location_lat is not None and db_vehicle.updated_at is not None:
        elapsed = (now - db_vehicle.updated_at).total_seconds()
        if elapsed < settings.telemetry_min_seconds:
            remaining = int(settings.telemetry_min_seconds - elapsed) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Telemetry rate limit. Retry in {remaining}s.",
                headers={"Retry-After": str(remaining)},
            )

    db_vehicle.current_location_lat = ping.latitude
    db_vehicle.current_location_lon = ping.longitude
    if ping.speed_kmh is not None:
        db_vehicle.speed_kmh = ping.speed_kmh
    # heading is not persisted on the Vehicle model (pilot scope); it is
    # forwarded in the SSE payload for live display only.
    db_vehicle.updated_at = now
    db.flush()
    events.emit(
        db,
        channel=events.VEHICLE,
        event_type=events.VEHICLE_UPDATED,
        payload={
            **events.vehicle_payload(db_vehicle),
            "heading": ping.heading,
        },
    )
    db.commit()


# ---------------------------------------------------------------------------
# Event streams (FSD-FR-086, ADR-024)
# ---------------------------------------------------------------------------


def _snapshot_hazards(db: Session) -> dict[str, Any]:
    """Active hazards, matching ``GET /api/v1/hazards/active``."""
    rows = (
        db.query(models.HazardZone)
        .filter(models.HazardZone.active.is_(True))
        .order_by(models.HazardZone.hazard_id)
        .all()
    )
    return {"hazards": [events.hazard_payload(row) for row in rows]}


def _snapshot_vehicles(db: Session) -> dict[str, Any]:
    rows = db.query(models.Vehicle).order_by(models.Vehicle.vehicle_id).all()
    return {"vehicles": [events.vehicle_payload(row) for row in rows]}


def _snapshot_sos(db: Session) -> dict[str, Any]:
    rows = (
        db.query(models.SOSRequest).order_by(models.SOSRequest.created_at.desc()).limit(100).all()
    )
    return {"sos": [events.sos_payload(row) for row in rows]}


def _event_stream(
    request: Request,
    *,
    channel: str,
    snapshot: Callable[[Session], dict[str, Any]],
    after: int | None,
):
    """Start an SSE relay, or refuse the subscription if the log is unreadable.

    The snapshot and the cursor are read before the response opens so a failure
    is a plain ``503`` (E015) the client can fall back from, rather than a stream
    that dies on its first frame.
    """
    try:
        cursor = events.parse_cursor(
            after=after, last_event_id=request.headers.get("last-event-id")
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    db = SessionLocal()
    try:
        latest = events.latest_id(db, channel)
        body = None if cursor is not None else snapshot(db)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Event stream unavailable") from exc
    finally:
        db.close()

    return StreamingResponse(
        events.stream(
            SessionLocal,
            channel=channel,
            cursor=latest if cursor is None else cursor,
            snapshot=body,
            snapshot_id=latest,
        ),
        media_type="text/event-stream",
        headers={
            # The stream is per-subscriber and per-instant: never cached, never
            # buffered by a proxy in front of the app.
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/v1/hazards/stream")
def stream_hazards(
    request: Request,
    after: Annotated[int | None, Query(ge=0, description="Resume after this event id")] = None,
    _user: models.User = Depends(require_user),
):
    """
    Hazard changes as server-sent events (FSD-FR-085, 086).

    Any authenticated account may subscribe: a driver needs the hazard layer
    more than the portal does. The first frame is a snapshot of the active
    hazards; afterwards each frame is a created, updated or published row.
    """
    return _event_stream(request, channel=events.HAZARD, snapshot=_snapshot_hazards, after=after)


@app.get("/api/v1/vehicles/stream")
def stream_vehicles(
    request: Request,
    after: Annotated[int | None, Query(ge=0, description="Resume after this event id")] = None,
    _user: models.User = Depends(require_admin),
):
    """
    Fleet changes as server-sent events (FSD-FR-086).

    Restricted to portal roles (SEC-007): a unit's live position is operational
    data, and a driver has no reason to see the whole fleet.
    """
    return _event_stream(request, channel=events.VEHICLE, snapshot=_snapshot_vehicles, after=after)


@app.get("/api/v1/sos/stream")
def stream_sos(
    request: Request,
    after: Annotated[int | None, Query(ge=0, description="Resume after this event id")] = None,
    _user: models.User = Depends(require_admin),
):
    """SOS creation, assignment and confirmation as server-sent events (FSD-FR-086)."""
    return _event_stream(request, channel=events.SOS, snapshot=_snapshot_sos, after=after)


@app.get("/api/v1/sos/{sos_id}", response_model=SOSResponse)
def get_sos(
    sos_id: int,
    _user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
) -> models.SOSRequest:
    """Return a single SOS request by id (FSD-FR-074).

    Available to any authenticated user so the driver app can poll the
    dispatch status of its own submission without needing dispatcher rights.
    Placed after `/stream` so the static subpath is not shadowed.
    """
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS request not found")
    return db_sos


# ---------------------------------------------------------------------------
# Audit trail (FSD-FR-093, TSD LIM-008)
# ---------------------------------------------------------------------------


def _audit_response(entry: models.AuditLog) -> AuditResponse:
    """Return the stored payload as an object instead of the JSON string."""
    try:
        payload = json.loads(entry.payload)
    except (TypeError, ValueError):  # pragma: no cover - defensive
        payload = {"unparsable": entry.payload}
    return AuditResponse(
        log_id=entry.log_id,
        user_id=entry.user_id,
        action_type=entry.action_type,
        payload=payload,
        hash_signature=entry.hash_signature,
        created_at=entry.created_at,
    )


@app.get("/api/v1/audit", response_model=list[AuditResponse])
def list_audit(
    action_type: str | None = None,
    user_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200, description="Newest entries to return")] = 50,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Newest first, one row per privileged action.

    This is the report behind FSD-FR-049: filter by ``action_type`` and
    ``user_id`` to reconstruct who did what during an event.
    """
    query = db.query(models.AuditLog)
    if action_type:
        query = query.filter(models.AuditLog.action_type == action_type)
    if user_id is not None:
        query = query.filter(models.AuditLog.user_id == user_id)
    entries = query.order_by(models.AuditLog.log_id.desc()).limit(limit).all()
    return [_audit_response(entry) for entry in entries]


@app.get("/api/v1/audit/verify", response_model=AuditVerifyResponse)
def verify_audit(
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Recompute the hash chain over the whole table.

    ``valid`` is only true when every row still matches its digest and the digest
    before it. A ``broken_at`` log id means that record, or one before it, was
    altered outside this API.
    """
    entries = db.query(models.AuditLog).order_by(models.AuditLog.log_id.asc()).all()
    return audit.verify_chain(entries)


@app.get("/api/v1/audit/export")
def export_audit_csv(
    action_type: str | None = None,
    user_id: int | None = None,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Export audit logs as CSV (FSD-FR-049)."""
    import csv
    from io import StringIO

    query = db.query(models.AuditLog)
    if action_type:
        query = query.filter(models.AuditLog.action_type == action_type)
    if user_id is not None:
        query = query.filter(models.AuditLog.user_id == user_id)
    entries = query.order_by(models.AuditLog.log_id.asc()).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["log_id", "user_id", "action_type", "payload", "hash_signature", "created_at"])

    for entry in entries:
        writer.writerow(
            [
                entry.log_id,
                entry.user_id,
                entry.action_type,
                entry.payload,
                entry.hash_signature,
                entry.created_at.isoformat() if entry.created_at else "",
            ]
        )

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )


@app.get("/api/v1/incidents/export")
def export_incidents_csv(
    status: str | None = None,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Export SOS incidents as CSV (FSD-FR-049)."""
    import csv
    from io import StringIO

    query = db.query(models.SOSRequest)
    if status:
        query = query.filter(models.SOSRequest.status == status.upper())
    incidents = query.order_by(models.SOSRequest.sos_id.asc()).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "sos_id",
            "latitude",
            "longitude",
            "note",
            "vehicle_id",
            "status",
            "created_at",
            "updated_at",
        ]
    )

    for incident in incidents:
        writer.writerow(
            [
                incident.sos_id,
                incident.latitude,
                incident.longitude,
                incident.note or "",
                incident.vehicle_id or "",
                incident.status,
                incident.created_at.isoformat() if incident.created_at else "",
                incident.updated_at.isoformat() if incident.updated_at else "",
            ]
        )

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=incidents.csv"},
    )


# ---------------------------------------------------------------------------
# Sensor endpoints (FSD-FR-090, FSD-FR-091, BR-017, BRULE-012)
# ---------------------------------------------------------------------------


@app.post("/api/v1/sensors/readings", response_model=SensorReadingResponse, status_code=201)
def create_sensor_reading(
    reading: SensorReadingRequest,
    # Admin only: a driver account must not be able to raise a breach.
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Gateway posts a sensor reading (FSD-FR-090)."""
    sensor = db.query(models.Sensor).filter(models.Sensor.sensor_id == reading.sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    if not sensor.active:
        raise HTTPException(status_code=409, detail="Sensor is disabled")
    if reading.unit != sensor.threshold_unit:
        raise HTTPException(
            status_code=422, detail=f"Sensor reports in {sensor.threshold_unit}, not {reading.unit}"
        )
    if reading.recorded_at > datetime.now(UTC):
        raise HTTPException(status_code=422, detail="Recorded timestamp cannot be in the future")

    # BRULE-012: a breach is advisory until a dispatcher confirms it.
    is_breach = reading.value >= sensor.threshold_value

    # Every reading is written to the roads in range, flagged or not, so the flood-state
    # resolver can tell "covered and quiet" from "not covered" (CR-004, FSD-FR-091).
    edge_ids: list[int] = []
    if sensor.geom is not None:
        # geography casts make the radius metres; plain 4326 geometry would read it as degrees.
        edge_ids = [
            row.edge_id
            for row in db.query(models.RoadEdge.edge_id)
            .join(models.Sensor, models.Sensor.sensor_id == sensor.sensor_id)
            .filter(
                func.ST_DWithin(
                    cast(models.RoadEdge.geom, _GEOG),
                    cast(models.Sensor.geom, _GEOG),
                    models.Sensor.impact_radius_m,
                ),
            )
        ]

    new_reading = models.SensorReading(
        sensor_id=reading.sensor_id,
        value=reading.value,
        unit=reading.unit,
        recorded_at=reading.recorded_at,
        received_at=datetime.now(UTC),
        breach=is_breach,
    )
    db.add(new_reading)
    _upsert_advisories(
        db,
        edge_ids,
        source=f"SENSOR:{sensor.sensor_id}",
        kind=flood_state.SIMULATED if sensor.simulated else flood_state.OBSERVED,
        flagged=is_breach,
        as_of=reading.recorded_at.astimezone(UTC).replace(tzinfo=None),
    )
    if is_breach:
        audit.record(
            db,
            user=_user,
            action_type=audit.SENSOR_BREACH,
            payload={
                "sensor_id": reading.sensor_id,
                "value": reading.value,
                "threshold": sensor.threshold_value,
                "impact_radius_m": sensor.impact_radius_m,
                "impacted_edge_ids": edge_ids,
                "actor": _user.name or _user.email,
            },
        )
    db.commit()
    db.refresh(new_reading)
    return new_reading


def _upsert_advisories(
    db: Session,
    edge_ids: list[int],
    *,
    source: str,
    kind: str,
    flagged: bool,
    as_of: datetime,
) -> None:
    """Record the latest observation of ``source`` on each edge; an older one never wins."""
    if not edge_ids:
        return
    stmt = pg_insert(models.EdgeAdvisory).values(
        [
            {"edge_id": edge_id, "source": source, "kind": kind, "flagged": flagged, "as_of": as_of}
            for edge_id in edge_ids
        ]
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_edge_advisory_edge_source",
        set_={
            "kind": stmt.excluded.kind,
            "flagged": stmt.excluded.flagged,
            "as_of": stmt.excluded.as_of,
            "updated_at": datetime.now(UTC).replace(tzinfo=None),
        },
        where=models.EdgeAdvisory.as_of <= stmt.excluded.as_of,
    )
    db.execute(stmt)


_HAZARD_SEVERITY = ("CAUTION", "LEVEL_2", "LEVEL_3", "IMPASSABLE")


def _is_raining(db: Session, now: datetime) -> bool:
    """The rain gate for the NOAH fallback: an active rain gauge is over its threshold right now."""
    window = timedelta(minutes=settings.flood_fresh_minutes)
    for sensor in (
        db.query(models.Sensor)
        .filter(models.Sensor.sensor_type == "RAIN_GAUGE", models.Sensor.active)
        .all()
    ):
        latest = (
            db.query(models.SensorReading)
            .filter(models.SensorReading.sensor_id == sensor.sensor_id)
            .order_by(models.SensorReading.recorded_at.desc())
            .first()
        )
        if latest and latest.breach:
            recorded = latest.recorded_at.astimezone(UTC).replace(tzinfo=None)
            if flood_state.is_fresh(recorded, now, window):
                return True
    return False


@app.get("/api/v1/flood-state", response_model=FloodStateResponse)
def get_flood_state(
    only_flagged: Annotated[
        bool, Query(description="Leave out segments with nothing flagged")
    ] = False,
    _user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Resolved flood state per road segment, with the source and "as of" time (CR-004).

    Verified hazards come first, then fresh live observations, then the NOAH fallback while
    it rains. A live advisory never closes a road, and a segment with no data reports
    ``NONE`` with ``has_live_data: false``: missing data is never reported as safe.
    """
    now = datetime.now(UTC).replace(tzinfo=None)
    window = timedelta(minutes=settings.flood_fresh_minutes)

    live: dict[int, list[flood_state.Observation]] = {}
    for adv in db.query(models.EdgeAdvisory).all():
        live.setdefault(adv.edge_id, []).append(
            flood_state.Observation(adv.source, adv.kind, adv.as_of, adv.flagged)
        )

    hazards, covered = _load_hazard_coverage(db)
    worst: dict[int, str] = {}
    for hazard in hazards:
        level = (hazard.obstruction_level or "").upper()
        for edge_id in covered.get(hazard.hazard_id, ()):
            current = worst.get(edge_id)
            if current is None or _HAZARD_SEVERITY.index(level) > _HAZARD_SEVERITY.index(current):
                worst[edge_id] = level
    # An unrecognised level sorts below CAUTION rather than failing the whole request.
    worst = {e: lv for e, lv in worst.items() if lv in _HAZARD_SEVERITY}

    raining = _is_raining(db, now)
    states: list[FloodStateEdge] = []
    for (edge_id,) in db.query(models.RoadEdge.edge_id).order_by(models.RoadEdge.edge_id).all():
        level = worst.get(edge_id)
        resolved = flood_state.resolve(
            flood_state.EdgeInputs(
                edge_id,
                hazard_level=level,
                hazard_blocks=hazard_blocks(level),
                live=tuple(live.get(edge_id, ())),
            ),
            now=now,
            raining=raining,
            fresh_window=window,
        )
        if only_flagged and resolved.basis == flood_state.NONE and not resolved.stale:
            continue
        states.append(FloodStateEdge(**asdict(resolved)))

    return FloodStateResponse(
        generated_at=now,
        raining=raining,
        fresh_window_minutes=settings.flood_fresh_minutes,
        edges=states,
    )


@app.get("/api/v1/sensors", response_model=list[SensorResponse])
def list_sensors(
    active_only: Annotated[bool, Query(description="Filter to active sensors only")] = True,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List sensor registry (FSD-FR-091)."""
    import models

    query = db.query(models.Sensor)
    if active_only:
        query = query.filter(models.Sensor.active)
    sensors = query.order_by(models.Sensor.sensor_id).all()
    return sensors


@app.post("/api/v1/sensors", response_model=SensorResponse, status_code=201)
def create_sensor(
    sensor: SensorCreateRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new sensor (FSD-FR-091)."""
    import models

    # Validate sensor type
    if sensor.sensor_type not in ("RIVER_GAUGE", "RAIN_GAUGE"):
        raise HTTPException(status_code=422, detail="sensor_type must be RIVER_GAUGE or RAIN_GAUGE")

    # Check duplicate sensor_id
    existing = db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor.sensor_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Sensor ID already exists")

    new_sensor = models.Sensor(
        sensor_id=sensor.sensor_id,
        sensor_type=sensor.sensor_type,
        name=sensor.name,
        geom=_point(sensor.latitude, sensor.longitude),
        threshold_value=sensor.threshold_value,
        threshold_unit=sensor.threshold_unit,
        impact_radius_m=sensor.impact_radius_m,
        active=True,
        simulated=sensor.simulated,
    )
    db.add(new_sensor)
    audit.record(
        db,
        user=_user,
        action_type=audit.SENSOR_CREATE,
        payload={
            "sensor_id": sensor.sensor_id,
            "name": sensor.name,
            "actor": _user.name or _user.email,
        },
    )
    db.commit()
    db.refresh(new_sensor)
    return new_sensor


@app.patch("/api/v1/sensors/{sensor_id}", response_model=SensorResponse)
def update_sensor(
    sensor_id: str,
    sensor: SensorUpdateRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update an existing sensor (FSD-FR-091)."""
    import models

    db_sensor = db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()
    if not db_sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    changes = sensor.model_dump(exclude_unset=True, exclude_none=True)
    lat, lon = changes.pop("latitude", None), changes.pop("longitude", None)
    for field, value in changes.items():
        setattr(db_sensor, field, value)
    if lat is not None:
        db_sensor.geom = _point(lat, lon)
        changes.update(latitude=lat, longitude=lon)

    audit.record(
        db,
        user=_user,
        action_type=audit.SENSOR_UPDATE,
        payload={
            "sensor_id": sensor_id,
            "changed": changes,
            "actor": _user.name or _user.email,
        },
    )
    db.commit()
    db.refresh(db_sensor)
    return db_sensor


@app.delete("/api/v1/sensors/{sensor_id}", status_code=204)
def delete_sensor(
    sensor_id: str,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a sensor (FSD-FR-091)."""
    import models

    db_sensor = db.query(models.Sensor).filter(models.Sensor.sensor_id == sensor_id).first()
    if not db_sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    audit.record(
        db,
        user=_user,
        action_type=audit.SENSOR_DELETE,
        payload={
            "sensor_id": sensor_id,
            "name": db_sensor.name,
            "actor": _user.name or _user.email,
        },
    )
    # Readings reference the sensor; the audit entry above keeps the record of the deletion.
    db.query(models.SensorReading).filter(models.SensorReading.sensor_id == sensor_id).delete()
    db.query(models.EdgeAdvisory).filter(
        models.EdgeAdvisory.source == f"SENSOR:{sensor_id}"
    ).delete()
    db.delete(db_sensor)
    db.commit()


@app.get("/api/v1/reports/{report_id}/nearest-sensor", response_model=NearestSensorReading)
def get_nearest_sensor_reading(
    report_id: str,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Cross-reference the nearest rain gauge reading for a selected report (FSD-FR-079)."""
    import models

    # Get the report
    report = (
        db.query(models.IncidentReport).filter(models.IncidentReport.report_id == report_id).first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.geometry is None:
        return NearestSensorReading()

    # Geography casts give metres; 4326 geometry would return degrees.
    distance_m = func.ST_Distance(
        cast(models.Sensor.geom, _GEOG), cast(models.IncidentReport.geometry, _GEOG)
    )

    # Find nearest active RAIN_GAUGE sensor with its latest reading
    nearest = (
        db.query(
            models.Sensor.sensor_id,
            models.Sensor.name,
            models.Sensor.sensor_type,
            models.Sensor.threshold_value,
            models.Sensor.threshold_unit,
            distance_m.label("distance"),
        )
        .join(models.IncidentReport, models.IncidentReport.report_id == report.report_id)
        .filter(models.Sensor.sensor_type == "RAIN_GAUGE")
        .filter(models.Sensor.active)
        .filter(models.Sensor.geom.isnot(None))
        .order_by(distance_m)
        .first()
    )

    if not nearest:
        return NearestSensorReading()

    # Get the latest reading for this sensor
    latest_reading = (
        db.query(models.SensorReading)
        .filter(models.SensorReading.sensor_id == nearest.sensor_id)
        .order_by(models.SensorReading.recorded_at.desc())
        .first()
    )

    if not latest_reading:
        return NearestSensorReading(
            sensor_id=nearest.sensor_id,
            sensor_name=nearest.name,
            sensor_type=nearest.sensor_type,
            distance_km=nearest.distance / 1000.0 if nearest.distance is not None else None,
        )

    # Check if reading is a breach
    is_breach = False
    if nearest.threshold_unit == latest_reading.unit:
        is_breach = latest_reading.value >= nearest.threshold_value

    return NearestSensorReading(
        sensor_id=nearest.sensor_id,
        sensor_name=nearest.name,
        sensor_type=nearest.sensor_type,
        latest_value=latest_reading.value,
        latest_unit=latest_reading.unit,
        latest_recorded_at=latest_reading.recorded_at,
        distance_km=nearest.distance / 1000.0 if nearest.distance is not None else None,
        is_breach=is_breach,
    )


# ---------------------------------------------------------------------------
# Field reports and moderation (FSD-FR-065 to 067, 077 to 081)
# ---------------------------------------------------------------------------


_GEOG = Geography(srid=4326)


def _point(latitude: float, longitude: float):
    """PostGIS point in longitude/latitude order, as WGS84."""
    return func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)


def _report_rows(db: Session, query):
    """Report rows plus the coordinates and photo size the contract exposes.

    The photo bytes are deferred: the queue needs their size, not the megabytes
    themselves, and only the photo endpoint ever reads the blob.
    """
    return query.options(defer(models.IncidentReport.photo_data)).all()


def _neighbour_map(rows, now: datetime) -> dict[UUID, tuple[int, UUID | None]]:
    """How many recent neighbours each pending report has, and the nearest.

    One pass over the pending rows already in memory rather than one query per
    report: the queue is bounded by the moderation limit, and this keeps the
    duplicate hint honest about *this* queue instead of inventing a second
    definition of "nearby".
    """
    window = timedelta(minutes=settings.report_duplicate_window_minutes)
    pending = [
        (report, latitude, longitude)
        for report, latitude, longitude, _ in rows
        if report.status == reports.WAITING and latitude is not None
    ]

    neighbours: dict[UUID, tuple[int, UUID | None]] = {}
    for report, latitude, longitude, _ in rows:
        if report.status != reports.WAITING or latitude is None:
            neighbours[report.report_id] = (0, None)
            continue

        count = 0
        nearest: UUID | None = None
        nearest_distance: float | None = None
        for other, other_lat, other_lon in pending:
            if other.report_id == report.report_id:
                continue
            if (
                abs((other.submitted_at - report.submitted_at).total_seconds())
                > window.total_seconds()
            ):
                continue
            distance = reports.haversine_m(latitude, longitude, other_lat, other_lon)
            if distance > settings.report_duplicate_radius_m:
                continue
            count += 1
            if nearest_distance is None or distance < nearest_distance:
                nearest_distance, nearest = distance, other.report_id
        neighbours[report.report_id] = (count, nearest)
    return neighbours


def _report_response(
    report: models.IncidentReport,
    latitude: float | None,
    longitude: float | None,
    photo_bytes: int | None,
    neighbour: tuple[int, UUID | None],
    now: datetime,
) -> ReportResponse:
    nearby, nearest = neighbour
    photo = None
    if report.photo_mime and photo_bytes is not None:
        photo = ReportPhotoInfo(
            mime=report.photo_mime,
            sha256=report.photo_sha256 or "",
            bytes=photo_bytes,
        )
    return ReportResponse(
        report_id=report.report_id,
        reporter_hash=report.reporter_hash,
        source=report.source,
        depth_level=report.depth_level,
        depth_label=reports.depth_label(report.depth_level),
        status=report.status,
        latitude=latitude,
        longitude=longitude,
        location_plausible=latitude is not None
        and longitude is not None
        and reports.location_plausible(latitude, longitude),
        barangay=report.barangay,
        narrative=report.narrative,
        urgency_score=reports.live_urgency(report.urgency_score, report.submitted_at, now),
        nearby_reports=nearby,
        possible_duplicate_of=nearest,
        photo=photo,
        exif=report.exif,
        captured_at=report.captured_at,
        submitted_at=report.submitted_at,
        duplicate_of=report.duplicate_of,
        moderated_by=report.moderated_by,
        moderated_at=report.moderated_at,
        decision_reason=report.decision_reason,
        hazard_id=report.hazard_id,
    )


def _report_detail(db: Session, report_id: UUID) -> ReportResponse:
    report = (
        db.query(models.IncidentReport).filter(models.IncidentReport.report_id == report_id).first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    row = (
        db.query(
            models.IncidentReport,
            func.ST_Y(models.IncidentReport.geometry),
            func.ST_X(models.IncidentReport.geometry),
            func.octet_length(models.IncidentReport.photo_data),
        )
        .options(defer(models.IncidentReport.photo_data))
        .filter(models.IncidentReport.report_id == report_id)
        .one()
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    return _report_response(
        row[0], row[1], row[2], row[3], _neighbour_map([row], now)[report_id], now
    )


def _parse_captured_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise HTTPException(
            status_code=422, detail="captured_at must be an ISO 8601 timestamp"
        ) from error
    # Stored columns are timezone-naive, matching every other timestamp here.
    return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed


@app.post(
    "/api/v1/reports",
    response_model=ReportResponse,
    status_code=201,
    dependencies=[Depends(rate_limit("reports", settings.rate_limit_reports_per_min))],
)
def submit_report(
    depth_level: Annotated[str, Form(description="ANKLE, KNEE or IMPASSABLE")],
    latitude: Annotated[float, Form(ge=-90, le=90)],
    longitude: Annotated[float, Form(ge=-180, le=180)],
    narrative: Annotated[str | None, Form(max_length=1000)] = None,
    barangay: Annotated[str | None, Form(max_length=120)] = None,
    captured_at: Annotated[str | None, Form(description="Device capture time, ISO 8601")] = None,
    source: Annotated[str | None, Form(description="PHOTO, SENSOR, CCTV or CALL")] = None,
    client_id: Annotated[
        UUID | None, Form(description="Device id; makes a replay idempotent")
    ] = None,
    photo: Annotated[UploadFile | None, File()] = None,
    _user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Submit a field report from the driver app (FSD-FR-065 to 067).

    Any authenticated account may report: a driver is the witness, and the
    moderation desk decides. The reporter is stored as a salted hash, never as a
    user id, so the queue can de-duplicate without holding an identity (BR-011).
    """
    # An offline replay whose first attempt already landed returns that report.
    if client_id is not None:
        existing = (
            db.query(models.IncidentReport.report_id)
            .filter(
                models.IncidentReport.client_id == client_id,
                models.IncidentReport.reporter_hash
                == reports.reporter_hash(_user.user_id, settings.report_hash_salt),
            )
            .first()
        )
        if existing:
            return _report_detail(db, existing[0])

    if depth_level not in reports.DEPTH_LEVELS:
        raise HTTPException(
            status_code=422, detail=f"depth_level must be one of {list(reports.DEPTH_LEVELS)}"
        )

    if source is not None and source not in reports.SOURCES:
        raise HTTPException(
            status_code=422, detail=f"source must be one of {list(reports.SOURCES)}"
        )

    photo_bytes: bytes | None = None
    photo_mime: str | None = None
    exif: dict[str, Any] | None = None
    if photo is not None and photo.filename:
        # Read one byte past the ceiling so the ceiling is what rejects it: a
        # size check against the declared Content-Length would trust the client.
        photo_bytes = photo.file.read(settings.report_photo_max_bytes + 1)
        if len(photo_bytes) > settings.report_photo_max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"photo must be {settings.report_photo_max_bytes} bytes or smaller",
            )
        # The declared Content-Type is a claim; the bytes decide (SEC-006).
        photo_mime = reports.sniff_image_mime(photo_bytes)
        if photo_mime is None:
            raise HTTPException(status_code=415, detail="photo must be a JPEG, PNG or WebP image")
        exif = reports.read_exif(photo_bytes) or None

    source = source or ("PHOTO" if photo_bytes is not None else "CALL")
    now = datetime.now(UTC).replace(tzinfo=None)
    point = _point(latitude, longitude)
    window_start = now - timedelta(minutes=settings.report_duplicate_window_minutes)

    # Neighbours corroborate the report and flag a possible duplicate; they are
    # never dropped silently (FSD-FR-081).
    nearby_ids = [
        row[0]
        for row in db.query(models.IncidentReport.report_id)
        .filter(
            models.IncidentReport.status == reports.WAITING,
            models.IncidentReport.submitted_at >= window_start,
            func.ST_DistanceSphere(models.IncidentReport.geometry, point)
            <= settings.report_duplicate_radius_m,
        )
        .order_by(func.ST_DistanceSphere(models.IncidentReport.geometry, point))
        .all()
    ]

    submitted = _parse_captured_at(captured_at)
    report = models.IncidentReport(
        report_id=uuid4(),
        client_id=client_id,
        reporter_hash=reports.reporter_hash(_user.user_id, settings.report_hash_salt),
        source=source,
        geometry=point,
        barangay=barangay,
        narrative=narrative,
        depth_level=depth_level,
        photo_data=photo_bytes,
        photo_mime=photo_mime,
        photo_sha256=None if photo_bytes is None else reports.photo_digest(photo_bytes),
        exif=exif,
        captured_at=submitted,
        submitted_at=now,
        urgency_score=reports.base_urgency(depth_level, source, len(nearby_ids)),
        status=reports.WAITING,
    )

    # A device-provided capture time wins; EXIF is the fallback, and it arrives as
    # a camera string rather than an ISO timestamp.
    if submitted is None and exif and exif.get("captured_at"):
        report.captured_at = _exif_timestamp(str(exif["captured_at"]))

    db.add(report)
    db.commit()
    db.refresh(report)

    return _report_response(
        report,
        latitude,
        longitude,
        len(photo_bytes) if photo_bytes is not None else None,
        (len(nearby_ids), nearby_ids[0] if nearby_ids else None),
        now,
    )


def _exif_timestamp(value: str) -> datetime | None:
    """Parse the camera's ``YYYY:MM:DD HH:MM:SS`` into a naive datetime."""
    try:
        return datetime.strptime(value.strip(), "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None


@app.get("/api/v1/reports", response_model=list[ReportResponse])
def list_reports(
    status: Annotated[
        str, Query(description="PENDING, VERIFIED, REJECTED or DUPLICATE")
    ] = reports.WAITING,
    limit: Annotated[int, Query(ge=1, le=200, description="Rows to return")] = 50,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    The moderation queue (FSD-FR-077), ordered by live urgency.

    ``urgency_score`` in the response is the stored submission-time score decayed
    by the report's age, which is what puts a fresh report above one that has
    been waiting for an hour.
    """
    if status not in reports.STATUSES:
        raise HTTPException(
            status_code=422, detail=f"status must be one of {list(reports.STATUSES)}"
        )

    rows = _report_rows(
        db,
        db.query(
            models.IncidentReport,
            func.ST_Y(models.IncidentReport.geometry),
            func.ST_X(models.IncidentReport.geometry),
            func.octet_length(models.IncidentReport.photo_data),
        ).filter(models.IncidentReport.status == status),
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    neighbours = _neighbour_map(rows, now)
    results = [
        _report_response(row[0], row[1], row[2], row[3], neighbours[row[0].report_id], now)
        for row in rows
    ]
    results.sort(key=lambda item: (item.urgency_score, item.submitted_at or now), reverse=True)
    return results[:limit]


@app.get("/api/v1/reports/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: UUID,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """One report with its evidence metadata, for the moderation detail view (FSD-FR-078)."""
    return _report_detail(db, report_id)


@app.get("/api/v1/reports/{report_id}/photo")
def get_report_photo(
    report_id: UUID,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Stream the evidence image. Evidence is never cached by an intermediary."""
    row = (
        db.query(models.IncidentReport.photo_data, models.IncidentReport.photo_mime)
        .filter(models.IncidentReport.report_id == report_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    data, mime = row
    if not data:
        raise HTTPException(status_code=404, detail="Report has no photo")
    return Response(
        content=data,
        media_type=mime or "application/octet-stream",
        headers={"Cache-Control": "private, no-store"},
    )


@app.post("/api/v1/reports/{report_id}/approve", response_model=ReportResponse)
def approve_report(
    report_id: UUID,
    approval: ReportApproveRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Verify a report and publish the hazard it evidences, in one action (FSD-FR-080).

    The report is one coordinate; the hazard is an area, so the marker gets a
    small polygon around the reported point and the depth description is mapped
    onto the hazard vocabulary. Publishing means ``active`` and ``published_at``
    are set immediately, so the driver map sees it on its next refresh.
    """
    report = (
        db.query(models.IncidentReport).filter(models.IncidentReport.report_id == report_id).first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != reports.WAITING:
        raise HTTPException(status_code=409, detail="Report has already been moderated")

    point = (
        db.query(
            func.ST_Y(models.IncidentReport.geometry),
            func.ST_X(models.IncidentReport.geometry),
        )
        .filter(models.IncidentReport.report_id == report_id)
        .one()
    )
    latitude, longitude = point

    obstruction_level, avg_depth_cm = reports.hazard_for(report.depth_level)
    max_id = db.query(func.max(models.HazardZone.hazard_id)).scalar() or 0
    now = datetime.now(UTC).replace(tzinfo=None)
    hazard = models.HazardZone(
        hazard_id=int(max_id) + 1,
        name=f"Reported {reports.depth_label(report.depth_level).lower()}"
        + (f" — {report.barangay}" if report.barangay else ""),
        obstruction_level=obstruction_level,
        avg_depth_cm=avg_depth_cm,
        notes=approval.notes or report.narrative,
        published_at=now,
        active=True,
        created_at=now,
        updated_at=now,
    )
    if latitude is not None and longitude is not None:
        hazard.geometry = func.ST_GeomFromText(reports.hazard_polygon(latitude, longitude), 4326)

    db.add(hazard)
    db.flush()

    report.status = reports.VERIFIED
    report.hazard_id = hazard.hazard_id
    report.moderated_by = _user.user_id
    report.moderated_at = now
    report.decision_reason = approval.notes

    audit.record(
        db,
        user=_user,
        action_type=audit.REPORT_APPROVE,
        payload={
            "report_id": str(report.report_id),
            "hazard_id": hazard.hazard_id,
            "depth_level": report.depth_level,
            "obstruction_level": obstruction_level,
        },
    )
    # Approval publishes the hazard, so drivers have to hear about it the same
    # way they hear about one published from the map editor.
    events.emit(
        db,
        channel=events.HAZARD,
        event_type=events.HAZARD_PUBLISHED,
        payload=events.hazard_payload(hazard),
    )
    db.commit()
    db.refresh(report)
    return _report_detail(db, report_id)


@app.post("/api/v1/reports/{report_id}/reject", response_model=ReportResponse)
def reject_report(
    report_id: UUID,
    rejection: ReportRejectRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Reject a report, or mark it as a duplicate of another, with a reason (FSD-FR-081).

    ``duplicate_of`` is the only difference between the two outcomes: both keep
    the evidence and the reason, because a duplicate is still a data point about
    how many people saw the same flood.
    """
    report = (
        db.query(models.IncidentReport).filter(models.IncidentReport.report_id == report_id).first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != reports.WAITING:
        raise HTTPException(status_code=409, detail="Report has already been moderated")

    if rejection.duplicate_of is not None:
        if rejection.duplicate_of == report_id:
            raise HTTPException(status_code=422, detail="A report cannot duplicate itself")
        original = (
            db.query(models.IncidentReport.report_id)
            .filter(models.IncidentReport.report_id == rejection.duplicate_of)
            .first()
        )
        if not original:
            raise HTTPException(status_code=404, detail="Duplicate target not found")

    now = datetime.now(UTC).replace(tzinfo=None)
    report.status = reports.DUPLICATE if rejection.duplicate_of else reports.REJECTED
    report.duplicate_of = rejection.duplicate_of
    report.decision_reason = rejection.reason
    report.moderated_by = _user.user_id
    report.moderated_at = now

    audit.record(
        db,
        user=_user,
        action_type=audit.REPORT_REJECT,
        payload={
            "report_id": str(report.report_id),
            "status": report.status,
            "reason": rejection.reason,
            "duplicate_of": None if rejection.duplicate_of is None else str(rejection.duplicate_of),
        },
    )
    db.commit()
    db.refresh(report)
    return _report_detail(db, report_id)


@app.post("/api/v1/reports/{report_id}/hold", response_model=ReportResponse)
def hold_report(
    report_id: UUID,
    hold_req: ReportHoldRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Hold a field report pending sensor update with a required reason (FSD-FR-041, FSD-FR-044)."""
    report = (
        db.query(models.IncidentReport).filter(models.IncidentReport.report_id == report_id).first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.decision_reason = hold_req.reason
    report.moderated_by = _user.user_id
    report.moderated_at = datetime.now(UTC).replace(tzinfo=None)
    audit.record(
        db,
        user=_user,
        action_type=audit.REPORT_HOLD,
        payload={
            "report_id": str(report.report_id),
            "reason": hold_req.reason,
            "actor": _user.name or _user.email,
        },
    )
    db.commit()
    db.refresh(report)
    return _report_detail(db, report_id)


@app.post("/api/v1/reports/{report_id}/escalate", response_model=ReportResponse)
def escalate_report(
    report_id: UUID,
    esc_req: ReportEscalateRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Escalate a field report to external services with a required reason (FSD-FR-040, FSD-FR-044)."""
    report = (
        db.query(models.IncidentReport).filter(models.IncidentReport.report_id == report_id).first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.decision_reason = f"Escalated to {esc_req.agency}: {esc_req.reason}"
    report.moderated_by = _user.user_id
    report.moderated_at = datetime.now(UTC).replace(tzinfo=None)
    audit.record(
        db,
        user=_user,
        action_type=audit.REPORT_ESCALATE,
        payload={
            "report_id": str(report.report_id),
            "agency": esc_req.agency,
            "reason": esc_req.reason,
            "actor": _user.name or _user.email,
        },
    )
    db.commit()
    db.refresh(report)
    return _report_detail(db, report_id)


@app.post("/api/v1/reports/{report_id}/notes", response_model=ReportResponse)
def add_report_note(
    report_id: UUID,
    note_req: ReportNoteRequest,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Add an internal operational note to a field report (FSD-FR-037, FSD-FR-043)."""
    report = (
        db.query(models.IncidentReport).filter(models.IncidentReport.report_id == report_id).first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    audit.record(
        db,
        user=_user,
        action_type=audit.REPORT_NOTE,
        payload={
            "report_id": str(report.report_id),
            "note": note_req.note,
            "actor": _user.name or _user.email,
        },
    )
    db.commit()
    db.refresh(report)
    return _report_detail(db, report_id)


@app.get("/api/v1/reports/{report_id}/log", response_model=list[IncidentLogItem])
def get_report_log(
    report_id: UUID,
    _user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Chronological operations log for a field report (FSD-FR-036, FSD-FR-043)."""
    import models

    report = (
        db.query(models.IncidentReport).filter(models.IncidentReport.report_id == report_id).first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    items: list[IncidentLogItem] = []
    if report.submitted_at:
        items.append(
            IncidentLogItem(
                log_id=0,
                time=report.submitted_at.strftime("%I:%M %p"),
                created_at=report.submitted_at,
                action_type="REPORT_SUBMITTED",
                actor_name="Citizen Reporter",
                text=f"Citizen report filed with {report.depth_level} flood depth",
                kind="muted",
            )
        )

    rows = (
        db.query(models.AuditLog, models.User.name, models.User.email)
        .outerjoin(models.User, models.AuditLog.user_id == models.User.user_id)
        .filter(models.AuditLog.payload.like(f'%"report_id":"{report_id}"%'))
        .order_by(models.AuditLog.log_id.asc())
        .all()
    )

    for log_row, user_name, user_email in rows:
        actor = user_name or user_email or "Dispatch Officer"
        try:
            payload = json.loads(log_row.payload)
        except Exception:
            continue
        if str(payload.get("report_id")) != str(report_id):
            continue

        time_str = log_row.created_at.strftime("%I:%M %p") if log_row.created_at else ""
        act = log_row.action_type

        if act == audit.REPORT_NOTE:
            kind = "note"
            text = f"{payload.get('note')} (by {actor})"
        elif act == audit.REPORT_APPROVE:
            kind = "action"
            text = f"Approved and published hazard #{payload.get('hazard_id')} by {actor}"
        elif act == audit.REPORT_REJECT:
            kind = "action"
            text = f"Report rejected by {actor}: {payload.get('reason')}"
        elif act == audit.REPORT_HOLD:
            kind = "action"
            text = f"Report held for sensor update by {actor}: {payload.get('reason')}"
        elif act == audit.REPORT_ESCALATE:
            kind = "action"
            text = f"Report escalated to {payload.get('agency', 'BFP')} by {actor}: {payload.get('reason')}"
        else:
            kind = "action"
            text = f"Action {act} recorded by {actor}"

        items.append(
            IncidentLogItem(
                log_id=log_row.log_id,
                time=time_str,
                created_at=log_row.created_at,
                action_type=act,
                actor_name=actor,
                text=text,
                kind=kind,
            )
        )

    return items


@app.get("/api/v1/hazards/active", response_model=list[HazardResponse])
def list_active_hazards(
    _user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Active hazards for the driver map's hazard layer (FSD-FR-059).

    Same rows as ``GET /hazards?active=true``; the named route exists because the
    driver app is specified against it and a client should not have to know that
    a filter parameter is the way to ask.
    """
    return (
        db.query(models.HazardZone)
        .filter(models.HazardZone.active.is_(True))
        .order_by(models.HazardZone.created_at.desc())
        .all()
    )
