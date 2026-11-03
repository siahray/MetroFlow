"""enable_rls_on_reports_and_event_log

Revision ID: a4c8e2d6b917
Revises: f3b7d9a1c562
Create Date: 2026-11-03

incident_reports (reporter hashes, evidence photos, EXIF) and event_log were created
without row level security, unlike the other application tables. Supabase exposes the
schema over PostgREST, so the anon key could read them. The API connects as a role
that owns the tables, so RLS does not affect it.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "a4c8e2d6b917"
down_revision: str | Sequence[str] | None = "f3b7d9a1c562"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("incident_reports", "event_log")


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
