"""enable row level security

Hosted Supabase exposes the ``public`` schema through the Data API (PostgREST),
and its default privileges grant ``anon``/``authenticated`` access to newly
created tables. Without RLS, the anon key -- public by design -- could read and
write these tables, including ``users.password_hash``.

Enabling RLS with no policies denies every request that does not arrive as the
table owner. The API's own connection uses the ``postgres`` role, which owns
these tables and therefore keeps working: owners bypass RLS unless
``FORCE ROW LEVEL SECURITY`` is set, and it deliberately is not.

The privilege revoke is belt and braces: if RLS is ever turned off by hand, the
Data API roles still cannot reach the tables. Those roles only exist on
Supabase, hence the guard.

Revision ID: a1b2c3d4e5f6
Revises: fd26e0cb82cc
Create Date: 2026-10-21

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "fd26e0cb82cc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# alembic_version is included so the Data API cannot rewrite migration state.
APP_TABLES = (
    "users",
    "audit_logs",
    "road_nodes",
    "road_edges",
    "live_edge_states",
    "alembic_version",
)

_PRIVILEGES_DO = """
DO $$
DECLARE
    tbl text;
    target_roles text;
BEGIN
    -- Supabase always has both roles; plain PostGIS does not have either, so
    -- resolve whichever exist instead of assuming a fixed pair.
    SELECT string_agg(quote_ident(rolname), ', ')
      INTO target_roles
      FROM pg_roles
     WHERE rolname IN ('anon', 'authenticated');

    IF target_roles IS NOT NULL THEN
        FOREACH tbl IN ARRAY ARRAY[{tables}]::text[]
        LOOP
            EXECUTE format('{statement}', tbl) || ' ' || target_roles;
        END LOOP;
    END IF;
END
$$;
"""


def _run_privilege_block(statement: str) -> None:
    tables = ", ".join(f"'{table}'" for table in APP_TABLES)
    op.execute(_PRIVILEGES_DO.format(tables=tables, statement=statement))


def upgrade() -> None:
    for table in APP_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    _run_privilege_block("REVOKE ALL ON TABLE %I FROM")


def downgrade() -> None:
    for table in APP_TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    _run_privilege_block("GRANT ALL ON TABLE %I TO")
