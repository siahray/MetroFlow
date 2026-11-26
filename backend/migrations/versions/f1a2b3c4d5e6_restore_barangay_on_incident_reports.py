"""restore_barangay_on_incident_reports

Revision ID: f1a2b3c4d5e6
Revises: e37c7bc39cdb
Create Date: 2026-11-26 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: str | Sequence[str] | None = "e37c7bc39cdb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("incident_reports", sa.Column("barangay", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("incident_reports", "barangay")
