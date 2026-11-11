"""road_edges.direction

Revision ID: f6a9c3e2b7d1
Revises: c2f8b3d1e9a7
Create Date: 2026-11-11

One-way streets from the OpenStreetMap import (osm_network.py) need a travel
direction per edge. Existing rows are bidirectional by the old router's
definition, so they all become BOTH.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f6a9c3e2b7d1"
down_revision: str | Sequence[str] | None = "c2f8b3d1e9a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "road_edges",
        sa.Column(
            "direction",
            sa.String(length=10),
            nullable=True,
            comment="BOTH, FORWARD (start to end only) or BACKWARD (end to start only)",
        ),
    )
    op.execute("UPDATE road_edges SET direction = 'BOTH' WHERE direction IS NULL")
    op.alter_column("road_edges", "direction", nullable=False)


def downgrade() -> None:
    op.drop_column("road_edges", "direction")
