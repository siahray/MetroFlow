"""add event log for the sse relays

The durable change feed the hazard, vehicle and SOS relays tail (FSD-FR-086).
A row is appended in the same transaction as the change it announces, so the
stream can never show a change that rolled back, and a client that reconnects
replays whatever it missed by event id (ADR-024).

Revision ID: c3855c67ec61
Revises: af7712baa2b3
Create Date: 2026-10-30 09:15:42.221006

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c3855c67ec61"
down_revision: str | Sequence[str] | None = "af7712baa2b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "event_log",
        sa.Column("event_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "channel",
            sa.String(length=30),
            nullable=False,
            comment="hazard, vehicle or sos",
        ),
        sa.Column(
            "event_type",
            sa.String(length=60),
            nullable=False,
            comment="e.g. hazard.published",
        ),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            comment="The changed row as the API returns it",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("event_id"),
    )
    # The tail query is always "this channel, after this id", so the pair is the
    # index. The created_at index keeps a future retention sweep cheap.
    op.create_index(
        "ix_event_log_channel_event_id", "event_log", ["channel", "event_id"], unique=False
    )
    op.create_index(op.f("ix_event_log_created_at"), "event_log", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_event_log_created_at"), table_name="event_log")
    op.drop_index("ix_event_log_channel_event_id", table_name="event_log")
    op.drop_table("event_log")
