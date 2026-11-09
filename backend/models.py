import uuid
from datetime import UTC, datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    UUID,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
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
    vehicle_id = Column(
        Integer,
        ForeignKey("vehicles.vehicle_id"),
        nullable=True,
        comment="Rescue unit a driver account is assigned to; null for portal accounts",
    )
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
    road_name = Column(
        String(120),
        nullable=True,
        comment="Arterial the edge runs along, used for spoken instructions",
    )
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


class HazardZone(Base):
    __tablename__ = "hazard_zones"
    hazard_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, comment="Operator label for the hazard")
    obstruction_level = Column(
        String(20),
        nullable=False,
        index=True,
        comment="CAUTION, LEVEL_2, LEVEL_3, IMPASSABLE",
    )
    # SMALLINT matches the deployed column: depths are centimetres and never
    # leave the 32k range. Widening it here would make ``alembic check`` drift.
    avg_depth_cm = Column(SmallInteger, nullable=True, comment="Average water depth in centimeters")
    # Generic so a hazard can be an area (Polygon, FSD-FR-082) or a closure
    # line (LineString, FSD-FR-083); migration a9c1f4e7d823 widened it from
    # POLYGON-only.
    geometry = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=True)
    edge_id = Column(
        Integer,
        ForeignKey("road_edges.edge_id"),
        nullable=True,
        comment="FK to road_edges for closure hazards",
    )
    notes = Column(Text, nullable=True, comment="Internal operator notes only")
    published_at = Column(DateTime, nullable=True, comment="Timestamp when hazard was published")
    active = Column(Boolean, default=True, index=True, comment="Whether hazard is currently active")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class Vehicle(Base):
    __tablename__ = "vehicles"
    vehicle_id = Column(Integer, primary_key=True, index=True)
    # ``unique=True`` with ``index=True`` renders the unique index the deployed
    # database has; ``unique`` alone would ask Alembic for a table constraint.
    call_sign = Column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
        comment="Unit call sign (e.g., RU-03)",
    )
    vehicle_type = Column(
        String(30),
        nullable=False,
        index=True,
        comment="AMBULANCE, RESCUE_BOAT, FIRE_TRUCK, PATROL",
    )
    clearance_cm = Column(Integer, nullable=True, comment="Vehicle ground clearance in centimeters")
    status = Column(
        String(20),
        nullable=False,
        index=True,
        comment="AVAILABLE, DISPATCHED, OUT_OF_SERVICE",
    )
    current_location_lat = Column(Float, nullable=True)
    current_location_lon = Column(Float, nullable=True)
    speed_kmh = Column(Float, nullable=True, comment="Current speed in km/h")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class Sensor(Base):
    __tablename__ = "sensors"
    sensor_id = Column(String(60), primary_key=True, index=True, unique=True)
    sensor_type = Column(String(20), nullable=False, index=True)  # RIVER_GAUGE or RAIN_GAUGE
    name = Column(String(120), nullable=False)  # Human label
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=True)  # Sensor location
    threshold_value = Column(Float, nullable=False)  # Breach threshold
    threshold_unit = Column(String(20), nullable=False)  # m or mm_hr
    impact_radius_m = Column(Float, nullable=False)  # Radius for edge marking
    active = Column(
        Boolean, default=True, index=True, nullable=True
    )  # Disabled sensors reject readings
    simulated = Column(Boolean, default=False, nullable=True)  # True for pilot-generated values

    @property
    def latitude(self) -> float | None:
        """Read back from ``geom`` for the registry view and map layer (FSD-FR-091)."""
        if self.geom is None:
            return None
        from geoalchemy2.shape import to_shape

        return to_shape(self.geom).y

    @property
    def longitude(self) -> float | None:
        if self.geom is None:
            return None
        from geoalchemy2.shape import to_shape

        return to_shape(self.geom).x


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    reading_id = Column(BigInteger, primary_key=True, index=True, unique=True)
    sensor_id = Column(String(60), ForeignKey("sensors.sensor_id"), nullable=False)
    value = Column(Float, nullable=False)  # Reading value
    unit = Column(String(20), nullable=False)  # Unit at capture
    recorded_at = Column(DateTime(timezone=True), nullable=False)  # Sensor timestamp
    received_at = Column(DateTime(timezone=True), nullable=False)  # Gateway receipt time
    breach = Column(Boolean, nullable=True)  # Threshold exceeded at evaluation time
    __table_args__ = (
        Index("ix_sensor_readings_sensor_id_recorded_at", "sensor_id", "recorded_at"),
        Index("ix_sensor_readings_breach_received_at", "breach", "received_at"),
    )


class EdgeAdvisory(Base):
    """The latest live observation that covers a road edge, one row per source (CR-004).

    A sensor reading is written to every edge inside the sensor's impact radius, flagged
    or not, so the flood-state resolver can tell "a live source covers this edge and is
    quiet" from "nothing covers this edge". Advisory only: nothing here closes a road
    (BRULE-012).
    """

    __tablename__ = "edge_advisories"
    advisory_id = Column(Integer, primary_key=True, index=True)
    edge_id = Column(
        Integer, ForeignKey("road_edges.edge_id", ondelete="CASCADE"), nullable=False, index=True
    )
    source = Column(String(80), nullable=False, comment="e.g. SENSOR:RIVER-01")
    kind = Column(String(12), nullable=False, comment="OBSERVED, MODELLED or SIMULATED")
    flagged = Column(Boolean, nullable=False, comment="Over its threshold at as_of")
    as_of = Column(DateTime, nullable=False, comment="When the value applies (UTC)")
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)
    __table_args__ = (UniqueConstraint("edge_id", "source", name="uq_edge_advisory_edge_source"),)


class SOSRequest(Base):
    __tablename__ = "sos_requests"
    sos_id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    note = Column(Text, nullable=True, comment="Optional text note")
    vehicle_id = Column(
        Integer,
        ForeignKey("vehicles.vehicle_id"),
        nullable=True,
        comment="FK to vehicles for assigned unit",
    )
    status = Column(
        String(20),
        default="pending",
        index=True,
        comment="PENDING, ASSIGNED, RESOLVED",
    )
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)
    dismissed_at = Column(
        DateTime, nullable=True, index=True, comment="Set when dismissed; purged after 72 h"
    )


class DispatchEvent(Base):
    """One milestone in a rescue mission's lifecycle (FSD-FR-087 to 089).

    Written in the same transaction as the change it records, like
    ``event_log``, so the portal's mission timeline can never show a step that
    rolled back. ``event_type`` is one of ``created``, ``assigned``,
    ``dispatched``, ``en_route``, ``arrived``, ``completed`` or ``cancelled``;
    ``en_route`` is derived from the first accepted telemetry ping on a live
    dispatch, ``arrived`` from the driver's on-scene action.
    """

    __tablename__ = "dispatch_events"
    event_id = Column(Integer, primary_key=True, index=True)
    sos_id = Column(
        Integer,
        ForeignKey("sos_requests.sos_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The dispatch this milestone belongs to",
    )
    vehicle_id = Column(
        Integer,
        ForeignKey("vehicles.vehicle_id", ondelete="SET NULL"),
        nullable=True,
        comment="Unit involved, when the milestone has one",
    )
    event_type = Column(
        String(20),
        nullable=False,
        index=True,
        comment="created, assigned, dispatched, en_route, arrived, completed, cancelled",
    )
    actor = Column(String(120), nullable=True, comment="Name or email of who caused it")
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)


class RateLimitCounter(Base):
    """
    One fixed window of requests for one counter bucket (TSD LIM-006).

    ``window_start`` is epoch seconds aligned to the window size. An integer
    rather than a timestamp keeps the atomic upsert free of timezone handling on
    both sides, and the pair is the primary key, so the increment is a single
    statement with no read-then-write race between serverless instances.
    """

    __tablename__ = "rate_limit_counters"
    bucket = Column(String(200), primary_key=True)
    window_start = Column(BigInteger, primary_key=True, index=True)
    request_count = Column(Integer, nullable=False)


class IncidentReport(Base):
    """A field report waiting for moderation, and the decision made on it.

    Shape follows TSD "Database Design - incident_reports". Two deliberate
    divergences, both recorded in the TSD note:

    * the reporter is a salted hash, never a user id, so the moderation desk can
      de-duplicate without holding an identity (BR-011);
    * the photo is stored in the row (``photo_data``) rather than as an object
      key, because this deployment has no object store and a serverless
      filesystem is ephemeral. The size is capped before the write.
    """

    __tablename__ = "incident_reports"
    report_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_hash = Column(
        String(64),
        nullable=False,
        index=True,
        comment="Salted hash of the reporter; no raw identity",
    )
    client_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        unique=True,
        index=True,
        comment="Device-generated id that makes an offline replay idempotent",
    )
    source = Column(
        String(20), nullable=False, default="PHOTO", comment="PHOTO, SENSOR, CCTV or CALL"
    )
    geometry = Column(Geometry(geometry_type="POINT", srid=4326), nullable=True)
    barangay = Column(String(120), nullable=True)
    narrative = Column(Text, nullable=True)
    depth_level = Column(
        String(20), nullable=False, index=True, comment="ANKLE, KNEE or IMPASSABLE"
    )
    photo_data = Column(LargeBinary, nullable=True, comment="Evidence image bytes, capped on write")
    photo_mime = Column(String(60), nullable=True)
    photo_sha256 = Column(String(64), nullable=True, comment="Integrity hash of photo_data")
    exif = Column(JSONB, nullable=True)
    captured_at = Column(DateTime, nullable=True, comment="Device capture time")
    submitted_at = Column(DateTime, default=_utcnow, nullable=False, index=True)
    urgency_score = Column(
        Float,
        nullable=False,
        default=0.0,
        comment="Submission-time urgency without recency; the API applies decay on read",
    )
    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
        comment="PENDING, VERIFIED, REJECTED or DUPLICATE",
    )
    duplicate_of = Column(
        UUID(as_uuid=True), ForeignKey("incident_reports.report_id"), nullable=True
    )
    moderated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    moderated_at = Column(DateTime, nullable=True)
    decision_reason = Column(Text, nullable=True, comment="Required for reject and duplicate")
    hazard_id = Column(
        Integer,
        ForeignKey("hazard_zones.hazard_id"),
        nullable=True,
        comment="Verified hazard created by approval",
    )
    dismissed_at = Column(
        DateTime, nullable=True, index=True, comment="Set when dismissed; purged after 72 h"
    )


class EventLog(Base):
    """Append-only change feed behind the SSE relays (FSD-FR-086, BR-018).

    A row is appended in the same transaction as the change it announces, so a
    committed hazard or vehicle always has a matching event and a rolled-back one
    never does. The relays tail the table by ``event_id``; that is what replaces
    Redis pub/sub in this deployment (ADR-024), because no Redis is provisioned
    and the hosted database sits behind a transaction pooler that cannot carry
    Postgres LISTEN/NOTIFY.
    """

    __tablename__ = "event_log"
    event_id = Column(BigInteger, primary_key=True, autoincrement=True)
    channel = Column(String(30), nullable=False, comment="hazard, vehicle or sos")
    event_type = Column(String(60), nullable=False, comment="e.g. hazard.published")
    payload = Column(JSONB, nullable=False, comment="The changed row as the API returns it")
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)

    __table_args__ = (Index("ix_event_log_channel_event_id", "channel", "event_id"),)
