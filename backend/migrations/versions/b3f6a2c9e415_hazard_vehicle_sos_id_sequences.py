"""hazard_vehicle_sos_id_sequences

Revision ID: b3f6a2c9e415
Revises: a9c1f4e7d823
Create Date: 2026-11-04

hazard_zones.hazard_id, vehicles.vehicle_id and sos_requests.sos_id were created
with ``autoincrement=False`` and no sequence (1311ec28b5ad), so every insert
through the ORM -- which relies on the column default, not a hand-picked id --
fails with a NOT NULL violation. Same bug and same fix as e2a9c4b7d815 did for
sensor_readings.reading_id.

The hosted database already has this fixed by hand (same unrecorded-manual-fix
pattern as the sensor one before e2a9c4b7d815), so this is written to be a
no-op there: it only creates a sequence and sets the default where the column
default is still missing, same as every fresh environment (CI, a new local DB).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "b3f6a2c9e415"
down_revision: str | Sequence[str] | None = "a9c1f4e7d823"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = (
    ("hazard_zones", "hazard_id"),
    ("vehicles", "vehicle_id"),
    ("sos_requests", "sos_id"),
)


def upgrade() -> None:
    for table, column in _COLUMNS:
        seq = f"{table}_{column}_seq"
        op.execute(
            f"""
            DO $$
            BEGIN
                IF (
                    SELECT column_default FROM information_schema.columns
                    WHERE table_name = '{table}' AND column_name = '{column}'
                ) IS NULL THEN
                    CREATE SEQUENCE {seq} OWNED BY {table}.{column};
                    -- Start after the highest id already stored so existing rows never collide.
                    PERFORM setval(
                        '{seq}', COALESCE((SELECT MAX({column}) FROM {table}), 0) + 1, false
                    );
                    ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT nextval('{seq}');
                END IF;
            END $$;
            """
        )


def downgrade() -> None:
    # Best-effort: on an environment where upgrade() was a no-op (the default
    # already existed), this leaves that pre-existing default alone rather than
    # guessing whether it was ours to remove.
    for table, column in _COLUMNS:
        seq = f"{table}_{column}_seq"
        op.execute(
            f"""
            DO $$
            BEGIN
                IF (
                    SELECT column_default FROM information_schema.columns
                    WHERE table_name = '{table}' AND column_name = '{column}'
                ) = 'nextval(''{seq}''::regclass)' THEN
                    ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT;
                    DROP SEQUENCE IF EXISTS {seq};
                END IF;
            END $$;
            """
        )
