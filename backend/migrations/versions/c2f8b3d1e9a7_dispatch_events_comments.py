"""dispatch_events_comments

Revision ID: c2f8b3d1e9a7
Revises: d7e2a9c4f815
Create Date: 2026-11-10

``a1f4e8c2d607`` created the table without the column comments the model
declares, which made ``alembic check`` (and therefore Backend CI) fail on
``main``. The table is already applied to the hosted database, so the comments
are added here instead of rewriting that revision.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c2f8b3d1e9a7"
down_revision: str | Sequence[str] | None = "d7e2a9c4f815"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COMMENTS = {
    "sos_id": "The dispatch this milestone belongs to",
    "vehicle_id": "Unit involved, when the milestone has one",
    "event_type": "created, assigned, dispatched, en_route, arrived, completed, cancelled",
    "actor": "Name or email of who caused it",
}


def upgrade() -> None:
    for column, comment in COMMENTS.items():
        op.alter_column("dispatch_events", column, comment=comment)


def downgrade() -> None:
    for column in COMMENTS:
        op.alter_column("dispatch_events", column, comment=None)
