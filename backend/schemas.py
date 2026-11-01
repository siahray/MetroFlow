from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from config import settings

PassabilityStatus = Literal["PASSABLE", "LIGHT_FLOOD", "SUBMERGED"]


def geometry_to_geojson(value: Any) -> dict[str, Any] | None:
    """Convert a PostGIS WKB value to a GeoJSON mapping, or ``None``.

    Hazards are stored as PostGIS polygons but the clients draw GeoJSON, so the
    conversion happens at the response boundary. A malformed value returns
    ``None`` rather than failing the whole response: the hazard still has an
    edge id and a level, which is enough to route around it.
    """
    if value is None or isinstance(value, dict):
        return value
    try:
        from geoalchemy2.shape import to_shape
        from shapely.geometry import mapping
    except ImportError:  # pragma: no cover - shapely is a runtime dependency
        return None
    try:
        return mapping(to_shape(value))
    except Exception:
        return None


class EdgeProperties(BaseModel):
    """Attributes the map renderer styles and the UI displays for one road edge."""

    edge_id: int
    start_node_id: int
    end_node_id: int
    start_name: str | None = None
    end_name: str | None = None
    road_name: str | None = None
    distance_m: float
    max_speed_kmh: float
    avg_speed_kmh: float
    water_depth_cm: float
    status: PassabilityStatus
    is_override: bool = False


class EdgeFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: int
    geometry: dict[str, Any] = Field(
        description="GeoJSON LineString. Coordinates are [longitude, latitude]."
    )
    properties: EdgeProperties


class NodeProperties(BaseModel):
    node_id: int
    name: str | None = None
    elevation_m: float


class NodeFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: int
    geometry: dict[str, Any] = Field(
        description="GeoJSON Point. Coordinates are [longitude, latitude]."
    )
    properties: NodeProperties


class EdgeFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[EdgeFeature] = Field(default_factory=list)


class NodeFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[NodeFeature] = Field(default_factory=list)


class NetworkStateResponse(BaseModel):
    """Full renderable road network for one vehicle clearance profile."""

    clearance_cm: float
    generated_at: datetime
    edges: EdgeFeatureCollection
    nodes: NodeFeatureCollection


class SimulationResponse(NetworkStateResponse):
    """Simulation result plus the resulting network, so the map updates in one call."""

    rainfall_mm_hr: float
    runoff_mm: float
    affected_edges: int
    message: str


class RouteSegment(BaseModel):
    """One traversed edge of the optimal route."""

    edge_id: int
    start_node_id: int
    end_node_id: int
    road_name: str | None = None
    distance_m: float = 0.0
    water_depth_cm: float
    status: PassabilityStatus


class RouteInstruction(BaseModel):
    """One turn-by-turn step (FSD-FR-057).

    ``distance_m`` is what remains on the step when it starts, measured to the
    next manoeuvre (or to the destination for the arrival step), so the banner
    can count down without recomputing the route.
    """

    manoeuvre: Literal[
        "DEPART",
        "ARRIVE",
        "STRAIGHT",
        "TURN_LEFT",
        "TURN_RIGHT",
        "SLIGHT_LEFT",
        "SLIGHT_RIGHT",
        "U_TURN",
    ]
    road_name: str | None = None
    distance_m: float
    start_node_id: int
    end_node_id: int
    text: str


class RouteHazard(BaseModel):
    """An active hazard that touches the returned route (FSD-FR-060, FSD-FR-063)."""

    hazard_id: int
    name: str
    obstruction_level: str
    avg_depth_cm: int | None = None
    edge_id: int | None = None
    blocking: bool = Field(description="True when this hazard's level excludes the edge it covers.")
    geometry: dict[str, Any] | None = Field(
        default=None,
        description="GeoJSON Polygon in [longitude, latitude] order, when the hazard has one.",
    )
    warning_radius_m: int


class RouteResponse(BaseModel):
    start_node: int
    target_node: int
    destination_name: str | None = None
    vehicle_clearance_cm: float
    optimal_path_nodes: list[int]
    geometry: dict[str, Any] = Field(
        description="GeoJSON LineString for the route. Coordinates are [longitude, latitude]."
    )
    segments: list[RouteSegment] = Field(default_factory=list)
    instructions: list[RouteInstruction] = Field(default_factory=list)
    hazards: list[RouteHazard] = Field(default_factory=list)
    total_distance_m: float = 0.0
    estimated_travel_time_minutes: float


# ---------------------------------------------------------------------------
# SOS / Hazards / Vehicles / Dispatch schemas
# ---------------------------------------------------------------------------


class SOSCreate(BaseModel):
    latitude: float
    longitude: float
    note: str | None = None


class SOSResponse(BaseModel):
    sos_id: int
    latitude: float
    longitude: float
    note: str | None = None
    vehicle_id: int | None = None
    status: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class HazardCreate(BaseModel):
    name: str
    obstruction_level: str = "partial"
    avg_depth_cm: int | None = None
    edge_id: int | None = None
    notes: str | None = None
    geometry: dict[str, Any] | None = None


class HazardUpdate(BaseModel):
    name: str | None = None
    obstruction_level: str | None = None
    avg_depth_cm: int | None = None
    edge_id: int | None = None
    active: bool | None = None
    notes: str | None = None


class HazardResponse(BaseModel):
    hazard_id: int
    name: str
    obstruction_level: str
    avg_depth_cm: int | None = None
    edge_id: int | None = None
    notes: str | None = None
    geometry: dict[str, Any] | None = Field(
        default=None,
        description="GeoJSON Polygon in [longitude, latitude] order, when the hazard has one.",
    )
    warning_radius_m: int = Field(
        default_factory=lambda: settings.warning_radius_m,
        description="Configured proximity radius the driver app alerts inside (FSD-FR-063).",
    )
    published_at: datetime | None = None
    active: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator("geometry", mode="before")
    @classmethod
    def _wkt_to_geojson(cls, value: Any) -> Any:
        """Turn the ORM's PostGIS WKB value into GeoJSON for the clients.

        The driver app draws hazard polygons and tests proximity against them,
        so the response has to carry geometry rather than just an edge id.
        """
        return geometry_to_geojson(value)


class VehicleCreate(BaseModel):
    call_sign: str
    vehicle_type: str
    clearance_cm: int | None = None
    status: str = "available"
    current_location_lat: float | None = None
    current_location_lon: float | None = None


class VehicleUpdate(BaseModel):
    call_sign: str | None = None
    vehicle_type: str | None = None
    clearance_cm: int | None = None
    status: str | None = None
    current_location_lat: float | None = None
    current_location_lon: float | None = None
    speed_kmh: float | None = None


class VehicleResponse(BaseModel):
    vehicle_id: int
    call_sign: str
    vehicle_type: str
    clearance_cm: int | None = None
    status: str
    current_location_lat: float | None = None
    current_location_lon: float | None = None
    speed_kmh: float | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class AssignRequest(BaseModel):
    vehicle_id: int


class ConfirmRequest(BaseModel):
    note: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str | None = "EMERGENCY_DRIVER"
    verification_code: str | None = None


class VerifyRequest(BaseModel):
    email: str
    code: str


class SendVerifyRequest(BaseModel):
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    user_id: int
    name: str
    email: str
    role: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class AuditResponse(BaseModel):
    """One attributable privileged action (FSD-FR-093)."""

    log_id: int
    user_id: int | None = None
    action_type: str
    # The stored JSON string, returned as an object so a client does not have to
    # parse a field the API produced.
    payload: dict[str, Any]
    hash_signature: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class AuditVerifyResponse(BaseModel):
    """Result of recomputing the audit hash chain."""

    valid: bool
    checked: int
    broken_at: int | None = None


class ReportPhotoInfo(BaseModel):
    """Evidence metadata. The bytes are served by the photo endpoint, not here."""

    mime: str
    sha256: str
    bytes: int


class ReportResponse(BaseModel):
    """A field report as the moderation desk sees it (FSD-FR-077, 078)."""

    report_id: UUID
    reporter_hash: str
    source: str
    depth_level: str
    depth_label: str
    status: str
    latitude: float | None = None
    longitude: float | None = None
    location_plausible: bool = True
    barangay: str | None = None
    narrative: str | None = None
    # The stored base score decayed by age, which is what the queue orders on.
    urgency_score: float
    # Derived on read: how many recent neighbours corroborate this report, and
    # the nearest one if it looks like the same event (FSD-FR-081).
    nearby_reports: int = 0
    possible_duplicate_of: UUID | None = None
    photo: ReportPhotoInfo | None = None
    exif: dict[str, Any] | None = None
    captured_at: datetime | None = None
    submitted_at: datetime | None = None
    duplicate_of: UUID | None = None
    moderated_by: int | None = None
    moderated_at: datetime | None = None
    decision_reason: str | None = None
    hazard_id: int | None = None


class ReportRejectRequest(BaseModel):
    """A rejection always says why (FSD-FR-081)."""

    reason: str = Field(min_length=3, max_length=500)
    # Supplying the report this one duplicates records DUPLICATE instead of
    # REJECTED; both keep the evidence and the reason.
    duplicate_of: UUID | None = None


class ReportApproveRequest(BaseModel):
    """Optional operator note carried into the hazard's notes."""

    notes: str | None = Field(default=None, max_length=500)
