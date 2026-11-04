"""comment_dismissed_at

Revision ID: e9b4c2d7a106
Revises: b3f6a2c9e415
Create Date: 2026-11-04

``c5d1a8f3e260`` added the columns without the comment the model declares, which
made ``alembic check`` (and therefore the API contract CI job) fail. It is
already applied to the hosted database, so the comment is added here instead of
rewriting that revision.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "e9b4c2d7a106"
down_revision: str | Sequence[str] | None = "b3f6a2c9e415"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("sos_requests", "incident_reports")
COMMENT = "Set when dismissed; purged after 72 h"


def upgrade() -> None:
    for table in TABLES:
        op.alter_column(table, "dismissed_at", comment=COMMENT)


def downgrade() -> None:
    for table in TABLES:
        op.alter_column(table, "dismissed_at", comment=None)
