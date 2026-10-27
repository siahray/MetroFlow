from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

PassabilityStatus = Literal["PASSABLE", "LIGHT_FLOOD", "SUBMERGED"]


class EdgeProperties(BaseModel):
    """Attributes the map renderer styles and the UI displays for one road edge."""

    edge_id: int
    start_node_id: int
    end_node_id: int
    start_name: str | None = None
    end_name: str | None = None
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
    water_depth_cm: float
    status: PassabilityStatus


class RouteResponse(BaseModel):
    start_node: int
    target_node: int
    vehicle_clearance_cm: float
    optimal_path_nodes: list[int]
    geometry: dict[str, Any] = Field(
        description="GeoJSON LineString for the route. Coordinates are [longitude, latitude]."
    )
    segments: list[RouteSegment] = Field(default_factory=list)
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
    published_at: datetime | None = None
    active: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


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
