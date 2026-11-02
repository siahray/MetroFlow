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


class TelemetryPing(BaseModel):
    """One position / speed batch from the driver app (FSD-FR-072, VAL-020)."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    speed_kmh: float | None = Field(
        None,
        ge=0,
        le=300,
        description="Speed in km/h at the moment of capture.",
    )
    heading: float | None = Field(
        None,
        ge=0,
        lt=360,
        description="Bearing in degrees clockwise from true north.",
    )
    recorded_at: datetime | None = Field(
        None,
        description="Device-side capture time; the server substitutes UTC now when absent.",
    )


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


class DispatchPreviewUnit(BaseModel):
    """One assignable unit ranked by flood-safe travel time (FSD-FR-088, FSD-FR-089)."""

    vehicle_id: int
    call_sign: str
    total_distance_m: float | None = None
    estimated_travel_time_minutes: float | None = None
    destination_name: str | None = None
    hazards: list[RouteHazard] = Field(default_factory=list)
    detail: str | None = Field(default=None, description="Why this unit has no route.")


class DispatchPreviewResponse(BaseModel):
    """Available units for one distress incident, fastest flood-safe route first."""

    sos_id: int
    units: list[DispatchPreviewUnit]


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


class UserCreateRequest(BaseModel):
    """Request to create a new user (FSD-FR-048)."""

    name: str = Field(..., min_length=1, max_length=100, description="Full name")
    email: str = Field(..., description="Email address (unique)")
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    role: str = Field(
        default="LGU_DISPATCHER",
        description="Role: SUPER_ADMIN, LGU_DISPATCHER, or EMERGENCY_DRIVER",
    )


class UserUpdateRequest(BaseModel):
    """Request to update an existing user (FSD-FR-048)."""

    name: str | None = Field(None, min_length=1, max_length=100)
    email: str | None = None
    role: str | None = Field(
        None,
        description="Role: SUPER_ADMIN, LGU_DISPATCHER, or EMERGENCY_DRIVER",
    )
    # Password update is a separate operation for security


class SensorReadingRequest(BaseModel):
    """Gateway posts a sensor reading (FSD-FR-090)."""

    sensor_id: str = Field(..., description="Sensor identifier")
    value: float = Field(..., description="Reading value")
    unit: str = Field(..., description="Unit at capture (m or mm_hr)")
    recorded_at: datetime = Field(..., description="Sensor timestamp")


class SensorReadingResponse(BaseModel):
    """Acknowledgment of a sensor reading."""

    reading_id: int
    sensor_id: str
    value: float
    unit: str
    recorded_at: datetime
    received_at: datetime
    breach: bool

    model_config = {"from_attributes": True}


class SensorResponse(BaseModel):
    """Sensor registry entry (FSD-FR-091)."""

    sensor_id: str
    sensor_type: str
    name: str
    threshold_value: float
    threshold_unit: str
    impact_radius_m: float
    active: bool
    simulated: bool

    model_config = {"from_attributes": True}


class NearestSensorReading(BaseModel):
    """Nearest sensor reading for a report (FSD-FR-079)."""

    sensor_id: str | None = None
    sensor_name: str | None = None
    sensor_type: str | None = None
    latest_value: float | None = None
    latest_unit: str | None = None
    latest_recorded_at: datetime | None = None
    distance_km: float | None = None
    is_breach: bool = False


class SensorCreateRequest(BaseModel):
    """Create a new sensor (FSD-FR-091)."""

    sensor_id: str = Field(..., description="Sensor identifier")
    sensor_type: str = Field(..., description="RIVER_GAUGE or RAIN_GAUGE")
    name: str = Field(..., description="Human label")
    threshold_value: float = Field(..., description="Breach threshold")
    threshold_unit: str = Field(..., description="m or mm_hr")
    impact_radius_m: float = Field(..., description="Radius for edge marking")
    simulated: bool = Field(False, description="True for pilot-generated values")


class SensorUpdateRequest(BaseModel):
    """Update an existing sensor (FSD-FR-091)."""

    name: str | None = None
    threshold_value: float | None = None
    threshold_unit: str | None = None
    impact_radius_m: float | None = None
    active: bool | None = None
    simulated: bool | None = None


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


# ---------------------------------------------------------------------------
# Dispatch & Incident Action Schemas (FSD-FR-039 to 046)
# ---------------------------------------------------------------------------


class SOSActionRequest(BaseModel):
    """Mandatory reason for rejecting or holding an incident (FSD-FR-044)."""

    reason: str = Field(min_length=3, max_length=500, description="Mandatory reason for action")


class SOSEscalateRequest(BaseModel):
    """Escalate an incident to external services (FSD-FR-040)."""

    agency: str = Field(default="BFP", max_length=50)
    reason: str = Field(min_length=3, max_length=500, description="Mandatory reason for escalation")


class SOSNoteRequest(BaseModel):
    """Internal operational triage note (FSD-FR-037)."""

    note: str = Field(min_length=1, max_length=500)


class ReportHoldRequest(BaseModel):
    """Mandatory reason for holding a field report (FSD-FR-044)."""

    reason: str = Field(min_length=3, max_length=500, description="Mandatory reason for hold")


class ReportEscalateRequest(BaseModel):
    """Escalate a field report to external services (FSD-FR-040)."""

    agency: str = Field(default="BFP", max_length=50)
    reason: str = Field(min_length=3, max_length=500, description="Mandatory reason for escalation")


class ReportNoteRequest(BaseModel):
    """Internal operational note for a field report (FSD-FR-037)."""

    note: str = Field(min_length=1, max_length=500)


class IncidentLogItem(BaseModel):
    """One attributable operations log entry (FSD-FR-036, FSD-FR-043)."""

    log_id: int
    time: str
    created_at: datetime
    action_type: str
    actor_name: str
    text: str
    kind: Literal["muted", "action", "note"]
