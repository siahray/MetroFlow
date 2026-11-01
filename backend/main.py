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
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, defer

import audit
import events
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
    EdgeFeature,
    EdgeFeatureCollection,
    EdgeProperties,
    HazardCreate,
    HazardResponse,
    HazardUpdate,
    LoginRequest,
    NetworkStateResponse,
    NodeFeature,
    NodeFeatureCollection,
    NodeProperties,
    RegisterRequest,
    ReportApproveRequest,
    ReportPhotoInfo,
    ReportRejectRequest,
    ReportResponse,
    RouteHazard,
    RouteInstruction,
    RouteResponse,
    RouteSegment,
    SendVerifyRequest,
    SimulationResponse,
    SOSCreate,
    SOSResponse,
    TelemetryPing,
    TokenResponse,
    UserResponse,
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
    """
    Provision the bootstrap LGU dispatcher when no users exist.

    Registration only ever creates driver accounts, so without this the portal
    has no account it can sign in with on a fresh database.
    """
    if db.query(models.User).count() > 0:
        return

    password_hash = bcrypt.hashpw(settings.admin_password.encode("utf-8"), bcrypt.gensalt()).decode(
        "utf-8"
    )
    db.add(
        models.User(
            name="LGU Dispatcher",
            email=settings.admin_email.strip().lower(),
            password_hash=password_hash,
            role="SUPER_ADMIN",
        )
    )
    db.commit()
    print(f"[startup] provisioned dispatcher account {settings.admin_email}")


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
    db_vehicle = (
        db.query(models.Vehicle).filter(models.Vehicle.vehicle_id == assign_req.vehicle_id).first()
    )
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db_sos.vehicle_id = assign_req.vehicle_id
    db_sos.status = "assigned"
    audit.record(
        db,
        user=_user,
        action_type=audit.SOS_ASSIGN,
        payload={
            "sos_id": db_sos.sos_id,
            "vehicle_id": assign_req.vehicle_id,
            "call_sign": db_vehicle.call_sign,
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
        },
    )
    db.flush()
    events.emit(
        db, channel=events.SOS, event_type=events.SOS_UPDATED, payload=events.sos_payload(db_sos)
    )
    db.commit()
    db.refresh(db_sos)
    return db_sos


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


@app.get("/api/v1/sos/{sos_id}", response_model=SOSResponse)
def get_sos(
    sos_id: int,
    _user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
) -> models.SOSRequest:
    """Return a single SOS request by id (FSD-FR-074).

    Available to any authenticated user so the driver app can poll the
    dispatch status of its own submission without needing dispatcher rights.
    """
    import models

    db_sos = db.query(models.SOSRequest).filter(models.SOSRequest.sos_id == sos_id).first()
    if not db_sos:
        raise HTTPException(status_code=404, detail="SOS request not found")
    return db_sos


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

    now = datetime.utcnow()
    if db_vehicle.updated_at is not None:
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


# ---------------------------------------------------------------------------
# Field reports and moderation (FSD-FR-065 to 067, 077 to 081)
# ---------------------------------------------------------------------------


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
