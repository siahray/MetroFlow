"""enable_rls_on_sensor_tables

Revision ID: f3b7d9a1c562
Revises: e1a9c3b7d204
Create Date: 2026-11-03

The sensors migration created both tables without row level security, unlike every
other table. Supabase exposes the schema over PostgREST, so the anon key could read
them. The API connects as a role that owns the tables, so RLS does not affect it.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "f3b7d9a1c562"
down_revision: str | Sequence[str] | None = "e1a9c3b7d204"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("sensors", "sensor_readings")


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
