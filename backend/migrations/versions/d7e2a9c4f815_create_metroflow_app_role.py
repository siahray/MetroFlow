"""create metroflow_app role and move table ownership (S-1 / LIM-023)

The API currently connects as ``postgres``, Supabase's own superuser. As table
owner it bypasses RLS (intentional, see ``a1b2c3d4e5f6``) but it is also a
superuser: it can create/drop roles and databases and reach every other
schema Supabase manages (``auth``, ``storage``, ...), none of which the app
needs.

This migration creates a plain, non-superuser ``metroflow_app`` role and
moves ownership of every app table and its sequences to it. Ownership (not a
grant) is what's needed: a non-owner, non-superuser role would be blocked by
the RLS-enabled-no-policies tables from ``a1b2c3d4e5f6``, and policies aren't
otherwise in use here, so ownership keeps today's access behavior while
dropping every privilege the app doesn't use.

This migration does NOT set the role's password or rotate ``DATABASE_URL`` --
that password is set out of band (``ALTER ROLE metroflow_app WITH
PASSWORD ...`` run by hand, never committed) and the connection string is
rotated in the hosted environment once the role is confirmed to work.

Revision ID: d7e2a9c4f815
Revises: a1f4e8c2d607
Create Date: 2026-11-10

"""

from collections.abc import Sequence

from alembic import op

revision: str = "d7e2a9c4f815"
down_revision: str | Sequence[str] | None = "a1f4e8c2d607"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

APP_ROLE = "metroflow_app"
ORIGINAL_OWNER = "postgres"

APP_TABLES = (
    "users",
    "audit_logs",
    "road_nodes",
    "road_edges",
    "live_edge_states",
    "hazard_zones",
    "vehicles",
    "sos_requests",
    "sensors",
    "sensor_readings",
    "incident_reports",
    "event_log",
    "edge_advisories",
    "dispatch_events",
    "rate_limit_counters",
    "alembic_version",
)

_CREATE_ROLE = f"""
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{APP_ROLE}') THEN
        CREATE ROLE {APP_ROLE} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
            NOREPLICATION NOBYPASSRLS;
    END IF;
END
$$;
"""

_REASSIGN_SEQUENCES = """
DO $$
DECLARE
    seq text;
BEGIN
    FOR seq IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER SEQUENCE %I OWNER TO %I', seq, '{owner}');
    END LOOP;
END
$$;
"""


def upgrade() -> None:
    op.execute(_CREATE_ROLE)
    # Supabase's "postgres" is not a true superuser: changing a table's owner
    # requires membership in the target role first, which the role's own
    # creator does not get automatically. A local/CI superuser already
    # bypasses this check, so the grant is harmless there too.
    op.execute(f"GRANT {APP_ROLE} TO CURRENT_USER")
    op.execute(f"GRANT USAGE, CREATE ON SCHEMA public TO {APP_ROLE}")

    for table in APP_TABLES:
        op.execute(f"ALTER TABLE {table} OWNER TO {APP_ROLE}")

    op.execute(_REASSIGN_SEQUENCES.format(owner=APP_ROLE))


def downgrade() -> None:
    for table in APP_TABLES:
        op.execute(f"ALTER TABLE {table} OWNER TO {ORIGINAL_OWNER}")

    op.execute(_REASSIGN_SEQUENCES.format(owner=ORIGINAL_OWNER))
    op.execute(f"REVOKE USAGE, CREATE ON SCHEMA public FROM {APP_ROLE}")
