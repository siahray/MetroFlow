"""add_edge_advisories

Revision ID: b7d3f1a9c248
Revises: a4c8e2d6b917
Create Date: 2026-11-03

CR-004: a sensor breach used to be recorded only inside its audit entry, so no road was
ever flagged (FSD-FR-091). edge_advisories keeps the latest live observation per road edge
and source, so the flood-state resolver can say which source flags a segment and as of
when. Row level security is enabled from the start, like every other table.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7d3f1a9c248"
down_revision: str | Sequence[str] | None = "a4c8e2d6b917"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "edge_advisories"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("advisory_id", sa.Integer(), nullable=False),
        sa.Column("edge_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=80), nullable=False, comment="e.g. SENSOR:RIVER-01"),
        sa.Column(
            "kind", sa.String(length=12), nullable=False, comment="OBSERVED, MODELLED or SIMULATED"
        ),
        sa.Column("flagged", sa.Boolean(), nullable=False, comment="Over its threshold at as_of"),
        sa.Column("as_of", sa.DateTime(), nullable=False, comment="When the value applies (UTC)"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["edge_id"], ["road_edges.edge_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("advisory_id"),
        sa.UniqueConstraint("edge_id", "source", name="uq_edge_advisory_edge_source"),
    )
    op.create_index(op.f("ix_edge_advisories_advisory_id"), TABLE, ["advisory_id"])
    op.create_index(op.f("ix_edge_advisories_edge_id"), TABLE, ["edge_id"])
    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index(op.f("ix_edge_advisories_edge_id"), table_name=TABLE)
    op.drop_index(op.f("ix_edge_advisories_advisory_id"), table_name=TABLE)
    op.drop_table(TABLE)
