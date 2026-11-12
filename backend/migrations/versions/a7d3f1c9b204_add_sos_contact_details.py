"""add_sos_contact_details

Revision ID: a7d3f1c9b204
Revises: f6a9c3e2b7d1
Create Date: 2026-11-12

Dispatch could not tell who was calling or which vehicle was in the water while
an SOS was active: the row held only coordinates and a note. The call-back number
now lives on the account (``users.mobile_number``) and is snapshotted onto the
SOS at creation, together with the plate the driver's garage reports. Snapshotting
rather than joining keeps the incident showing what was reported even after the
driver edits their profile, and lets the portal read one row.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7d3f1c9b204"
down_revision: str | Sequence[str] | None = "f6a9c3e2b7d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "mobile_number",
            sa.String(length=20),
            nullable=True,
            comment="Call-back number dispatch uses while this account has an active SOS",
        ),
    )
    op.add_column(
        "sos_requests",
        sa.Column(
            "reporter_phone",
            sa.String(length=20),
            nullable=True,
            comment="Reporter's mobile number as it was when the SOS was raised",
        ),
    )
    op.add_column(
        "sos_requests",
        sa.Column(
            "plate_number",
            sa.String(length=16),
            nullable=True,
            comment="Plate of the vehicle the reporter named, for on-scene identification",
        ),
    )


def downgrade() -> None:
    op.drop_column("sos_requests", "plate_number")
    op.drop_column("sos_requests", "reporter_phone")
    op.drop_column("users", "mobile_number")
