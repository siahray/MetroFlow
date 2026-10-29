import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated, Any

import bcrypt
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import models
import network_seed
from auth_utils import get_current_user, require_roles
from config import settings
from database import get_db
from geometry import backfill_geometry
from hydrology import calculate_scs_cn_runoff, compute_node_water_depth
from rate_limit import prune as prune_rate_limits
from rate_limit import rate_limit
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
    LoginRequest,
    NetworkStateResponse,
    NodeFeature,
    NodeFeatureCollection,
    NodeProperties,
    RegisterRequest,
    RouteResponse,
    RouteSegment,
    SendVerifyRequest,
    SimulationResponse,
    SOSCreate,
    SOSResponse,
    TokenResponse,
    UserResponse,
    VehicleCreate,
    VehicleResponse,
    VehicleUpdate,
    VerifyRequest,
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
    _user: models.User = Depends(require_user),
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
    if hazard.name is not None:
        db_hazard.name = hazard.name
    if hazard.obstruction_level is not None:
        db_hazard.obstruction_level = hazard.obstruction_level
    if hazard.avg_depth_cm is not None:
        db_hazard.avg_depth_cm = hazard.avg_depth_cm
    if hazard.edge_id is not None:
        db_hazard.edge_id = hazard.edge_id
    if hazard.active is not None:
        db_hazard.active = hazard.active
    if hazard.notes is not None:
        db_hazard.notes = hazard.notes
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
    for field, value in vehicle.model_dump(exclude_unset=True).items():
        setattr(db_vehicle, field, value)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle
