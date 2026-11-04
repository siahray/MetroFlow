"""add_dismissed_at

Revision ID: c5d1a8f3e260
Revises: b8e4c1a7d952
Create Date: 2026-11-04

A dispatcher dismisses an incident from the triage queue. The row is kept for a
review window (72 h) and then purged, so the timestamp is the only state needed.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c5d1a8f3e260"
down_revision: str | Sequence[str] | None = "b8e4c1a7d952"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("sos_requests", "incident_reports")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column("dismissed_at", sa.DateTime(), nullable=True))
        op.create_index(f"ix_{table}_dismissed_at", table, ["dismissed_at"])


def downgrade() -> None:
    for table in TABLES:
        op.drop_index(f"ix_{table}_dismissed_at", table_name=table)
        op.drop_column(table, "dismissed_at")
