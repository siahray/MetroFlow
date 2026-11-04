"""add_user_vehicle_id

Revision ID: b8e4c1a7d952
Revises: b7d3f1a9c248
Create Date: 2026-11-04

A driver account has to know which rescue unit it reports as: the app posts that
unit's telemetry and reads that unit's mission. The link was missing, so the
vehicle could only be named by an environment variable (FSD-FR-072).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b8e4c1a7d952"
down_revision: str | Sequence[str] | None = "b7d3f1a9c248"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "vehicle_id",
            sa.Integer(),
            sa.ForeignKey("vehicles.vehicle_id", name="users_vehicle_id_fkey"),
            nullable=True,
            comment="Rescue unit a driver account is assigned to; null for portal accounts",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "vehicle_id")
