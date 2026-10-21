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
