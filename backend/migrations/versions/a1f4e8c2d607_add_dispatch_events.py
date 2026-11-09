"""add_dispatch_events

Revision ID: a1f4e8c2d607
Revises: e9b4c2d7a106
Create Date: 2026-11-09

Mission milestone timeline (FSD-FR-087 to 089, BACKLOG F-4): one row per
dispatch lifecycle step so the portal can show Signal received, Assigned,
Dispatched, En route, On scene and Completed/Cancelled with real timestamps.
RLS is enabled like every other public table.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1f4e8c2d607"
down_revision: str | Sequence[str] | None = "e9b4c2d7a106"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dispatch_events",
        sa.Column("event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sos_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("actor", sa.String(length=120), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        # The 72 h dismissed-incident purge deletes sos rows; the timeline goes
        # with its incident. A deleted unit keeps its milestones (SET NULL).
        sa.ForeignKeyConstraint(["sos_id"], ["sos_requests.sos_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.vehicle_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("event_id"),
    )
    op.create_index(
        op.f("ix_dispatch_events_event_id"), "dispatch_events", ["event_id"], unique=False
    )
    op.create_index(op.f("ix_dispatch_events_sos_id"), "dispatch_events", ["sos_id"], unique=False)
    op.create_index(
        op.f("ix_dispatch_events_event_type"), "dispatch_events", ["event_type"], unique=False
    )
    op.execute("ALTER TABLE dispatch_events ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.execute("ALTER TABLE dispatch_events DISABLE ROW LEVEL SECURITY")
    op.drop_index(op.f("ix_dispatch_events_event_type"), table_name="dispatch_events")
    op.drop_index(op.f("ix_dispatch_events_sos_id"), table_name="dispatch_events")
    op.drop_index(op.f("ix_dispatch_events_event_id"), table_name="dispatch_events")
    op.drop_table("dispatch_events")
