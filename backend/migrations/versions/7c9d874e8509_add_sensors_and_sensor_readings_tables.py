"""add_sensors_and_sensor_readings_tables

Revision ID: 7c9d874e8509
Revises: 1311ec28b5ad
Create Date: 2026-11-02 13:50:34.708250

Add sensor registry and sensor readings tables for impact-based
hazard advisory system (FSD-FR-090, FSD-FR-091, BR-017, BRULE-012).
"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7c9d874e8509"
down_revision: str | Sequence[str] | None = "1311ec28b5ad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sensors",
        sa.Column("sensor_id", sa.String(length=60), nullable=False),
        sa.Column("sensor_type", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "geom",
            geoalchemy2.Geometry(geometry_type="POINT", srid=4326),
            nullable=True,
        ),
        sa.Column("threshold_value", sa.Float(), nullable=False),
        sa.Column("threshold_unit", sa.String(length=20), nullable=False),
        sa.Column("impact_radius_m", sa.Float(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=True),
        sa.Column("simulated", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("sensor_id"),
    )
    op.create_index(op.f("ix_sensors_sensor_id"), "sensors", ["sensor_id"], unique=True)
    op.create_index(op.f("ix_sensors_sensor_type"), "sensors", ["sensor_type"], unique=False)
    op.create_index(op.f("ix_sensors_active"), "sensors", ["active"], unique=False)
    # GiST index on geometry is created automatically by GeoAlchemy2

    op.create_table(
        "sensor_readings",
        sa.Column("reading_id", sa.BigInteger(), autoincrement=False, nullable=False),
        sa.Column("sensor_id", sa.String(length=60), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column("recorded_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("received_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("breach", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("reading_id"),
        sa.ForeignKeyConstraint(
            ["sensor_id"],
            ["sensors.sensor_id"],
        ),
    )
    op.create_index(
        op.f("ix_sensor_readings_reading_id"),
        "sensor_readings",
        ["reading_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_sensor_readings_sensor_id_recorded_at"),
        "sensor_readings",
        ["sensor_id", "recorded_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sensor_readings_breach_received_at"),
        "sensor_readings",
        ["breach", "received_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_sensor_readings_breach_received_at"), table_name="sensor_readings")
    op.drop_index(op.f("ix_sensor_readings_sensor_id_recorded_at"), table_name="sensor_readings")
    op.drop_index(op.f("ix_sensor_readings_reading_id"), table_name="sensor_readings")
    op.drop_table("sensor_readings")
    op.drop_index(op.f("ix_sensors_active"), table_name="sensors")
    op.drop_index(op.f("ix_sensors_sensor_type"), table_name="sensors")
    op.drop_index(op.f("ix_sensors_sensor_id"), table_name="sensors")
    op.drop_table("sensors")
