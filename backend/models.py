from datetime import UTC, datetime

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


def _utcnow() -> datetime:
    """
    Naive UTC timestamp.

    ``datetime.utcnow()`` is deprecated on modern Python. The existing DateTime
    columns are timezone-naive, so the tzinfo is stripped to keep stored values
    and comparisons consistent with the previous behaviour.
    """
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(
        String(20), default="LGU_DISPATCHER"
    )  # SUPER_ADMIN, LGU_DISPATCHER, EMERGENCY_DRIVER
    created_at = Column(DateTime, default=_utcnow)


class RoadNode(Base):
    __tablename__ = "road_nodes"
    node_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation_m = Column(Float, default=10.0)  # Elevation for hydrological accumulation
    geom = Column(Geometry(geometry_type="POINT", srid=4326))


class RoadEdge(Base):
    __tablename__ = "road_edges"
    edge_id = Column(Integer, primary_key=True, index=True)
    start_node_id = Column(Integer, ForeignKey("road_nodes.node_id"), nullable=False)
    end_node_id = Column(Integer, ForeignKey("road_nodes.node_id"), nullable=False)
    distance_meters = Column(Float, nullable=False)
    max_speed_kmh = Column(Float, default=50.0)
    lanes = Column(Integer, default=2)
    geom = Column(Geometry(geometry_type="LINESTRING", srid=4326))

    state = relationship("LiveEdgeState", back_populates="edge", uselist=False)


class LiveEdgeState(Base):
    __tablename__ = "live_edge_states"
    state_id = Column(Integer, primary_key=True, index=True)
    edge_id = Column(Integer, ForeignKey("road_edges.edge_id"), unique=True, nullable=False)
    water_depth_cm = Column(Float, default=0.0)
    avg_speed_kmh = Column(Float, default=50.0)
    vehicle_density = Column(Float, default=0.1)  # Vehicles per meter
    is_override = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    edge = relationship("RoadEdge", back_populates="state")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    action_type = Column(String(50), nullable=False)  # e.g. NODE_OVERRIDE, SIMULATION_TRIGGER
    payload = Column(Text, nullable=False)
    hash_signature = Column(String(64), nullable=False)  # Cryptographic SHA-256
    created_at = Column(DateTime, default=_utcnow)
