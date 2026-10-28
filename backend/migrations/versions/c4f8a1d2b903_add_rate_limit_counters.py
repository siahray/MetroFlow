"""add_rate_limit_counters

Revision ID: c4f8a1d2b903
Revises: 1311ec28b5ad
Create Date: 2026-10-28

The API is reachable from the internet, and the request ceilings that protect it
(TSD LIM-006) need a counter that survives a serverless instance being replaced.
The database is the only store every instance shares, so the counter is a table:
one row per counter bucket per aligned window, incremented with an upsert.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4f8a1d2b903"
down_revision: str | Sequence[str] | None = "1311ec28b5ad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "rate_limit_counters"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("bucket", sa.String(length=200), nullable=False),
        sa.Column("window_start", sa.BigInteger(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("bucket", "window_start"),
    )
    # The startup cleanup deletes by window_start, not by bucket.
    op.create_index(op.f("ix_rate_limit_counters_window_start"), TABLE, ["window_start"])

    # Match the other tables: Supabase exposes the schema over PostgREST, and
    # these counters are internal. The API connects as a role that owns the
    # table, so RLS does not affect it.
    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute("""
    DO $$
    DECLARE
        target_roles text;
    BEGIN
        SELECT string_agg(quote_ident(rolname), ', ')
          INTO target_roles
          FROM pg_roles
         WHERE rolname IN ('anon', 'authenticated');

        IF target_roles IS NOT NULL THEN
            EXECUTE 'REVOKE ALL ON TABLE rate_limit_counters FROM ' || target_roles;
        END IF;
    END
    $$;
    """)


def downgrade() -> None:
    op.drop_index(op.f("ix_rate_limit_counters_window_start"), table_name=TABLE)
    op.drop_table(TABLE)
