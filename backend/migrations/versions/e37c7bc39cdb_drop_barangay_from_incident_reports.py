"""drop_barangay_from_incident_reports

Revision ID: e37c7bc39cdb
Revises: b8c4d2a9f615
Create Date: 2026-11-21 13:57:35.445133

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e37c7bc39cdb"
down_revision: str | Sequence[str] | None = "b8c4d2a9f615"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("incident_reports", "barangay")


def downgrade() -> None:
    op.add_column("incident_reports", sa.Column("barangay", sa.String(length=120), nullable=True))
