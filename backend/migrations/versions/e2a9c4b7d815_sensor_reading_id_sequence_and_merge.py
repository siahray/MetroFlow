"""sensor_reading_id_sequence_and_merge

Revision ID: e2a9c4b7d815
Revises: 7c9d874e8509, 5d8a58ada077
Create Date: 2026-11-03 10:00:00.000000

Two things in one revision:

* Merges the two heads (sensors, and incident reports through road names), so
  ``alembic upgrade head`` has a single target again.
* Gives ``sensor_readings.reading_id`` a sequence. The handler used to compute
  ``max(reading_id) + 1``, which collides when two gateways post at once.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "e2a9c4b7d815"
down_revision: str | Sequence[str] | None = ("7c9d874e8509", "5d8a58ada077")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE sensor_readings_reading_id_seq OWNED BY sensor_readings.reading_id")
    # Start after the highest id already stored so existing rows never collide.
    op.execute(
        "SELECT setval('sensor_readings_reading_id_seq', "
        "COALESCE((SELECT MAX(reading_id) FROM sensor_readings), 0) + 1, false)"
    )
    op.execute(
        "ALTER TABLE sensor_readings ALTER COLUMN reading_id "
        "SET DEFAULT nextval('sensor_readings_reading_id_seq')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE sensor_readings ALTER COLUMN reading_id DROP DEFAULT")
    op.execute("DROP SEQUENCE sensor_readings_reading_id_seq")
