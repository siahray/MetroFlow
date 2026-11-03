"""add_report_client_id

Revision ID: e1a9c3b7d204
Revises: e2a9c4b7d815
Create Date: 2026-11-03

The driver app queues reports while offline and replays them on reconnect
(FSD-FR-068, 069). A device-generated id makes the replay idempotent: a retry
after a lost response returns the stored report instead of creating a second.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e1a9c3b7d204"
down_revision: str | Sequence[str] | None = "e2a9c4b7d815"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "incident_reports",
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Device-generated id that makes an offline replay idempotent",
        ),
    )
    op.create_index("ix_incident_reports_client_id", "incident_reports", ["client_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_incident_reports_client_id", table_name="incident_reports")
    op.drop_column("incident_reports", "client_id")
