"""add_column_comments

Revision ID: d7c2b9f4a610
Revises: c4f8a1d2b903
Create Date: 2026-10-28

The hosted database carries operator-facing comments on the hazard, vehicle and
SOS columns, but the revisions that created those tables never wrote them, so a
database built from the migration history disagreed with the one the API runs
against. The comments are part of the schema the models now declare, so they
belong in the history as well: without this, ``alembic check`` fails against the
hosted database and a freshly migrated one has none of the documentation.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7c2b9f4a610"
down_revision: str | Sequence[str] | None = "c4f8a1d2b903"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COMMENTS: dict[tuple[str, str], str] = {
    ("hazard_zones", "name"): "Operator label for the hazard",
    ("hazard_zones", "obstruction_level"): "CAUTION, LEVEL_2, LEVEL_3, IMPASSABLE",
    ("hazard_zones", "avg_depth_cm"): "Average water depth in centimeters",
    ("hazard_zones", "edge_id"): "FK to road_edges for closure hazards",
    ("hazard_zones", "notes"): "Internal operator notes only",
    ("hazard_zones", "published_at"): "Timestamp when hazard was published",
    ("hazard_zones", "active"): "Whether hazard is currently active",
    ("vehicles", "call_sign"): "Unit call sign (e.g., RU-03)",
    ("vehicles", "vehicle_type"): "AMBULANCE, RESCUE_BOAT, FIRE_TRUCK, PATROL",
    ("vehicles", "clearance_cm"): "Vehicle ground clearance in centimeters",
    ("vehicles", "status"): "AVAILABLE, DISPATCHED, OUT_OF_SERVICE",
    ("vehicles", "speed_kmh"): "Current speed in km/h",
    ("sos_requests", "note"): "Optional text note",
    ("sos_requests", "vehicle_id"): "FK to vehicles for assigned unit",
    ("sos_requests", "status"): "PENDING, ASSIGNED, RESOLVED",
}


def upgrade() -> None:
    for (table, column), comment in COMMENTS.items():
        # COMMENT ON is idempotent, so re-running against the hosted database
        # (where these already exist) changes nothing.
        op.execute(f"COMMENT ON COLUMN {table}.{column} IS '{comment}'")


def downgrade() -> None:
    for table, column in COMMENTS:
        op.execute(f"COMMENT ON COLUMN {table}.{column} IS NULL")
