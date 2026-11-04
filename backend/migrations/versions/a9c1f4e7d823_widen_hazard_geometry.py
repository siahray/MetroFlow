"""widen_hazard_geometry

Revision ID: a9c1f4e7d823
Revises: c5d1a8f3e260
Create Date: 2026-11-04

hazard_zones.geometry was typed POLYGON-only, so a drawn closure line
(FSD-FR-083) could not be stored. Widen it to a generic geometry column; the
existing polygons migrate as-is since Polygon is a subtype of Geometry.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "a9c1f4e7d823"
down_revision: str | Sequence[str] | None = "c5d1a8f3e260"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE hazard_zones ALTER COLUMN geometry TYPE geometry(Geometry, 4326)")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE hazard_zones ALTER COLUMN geometry TYPE geometry(Polygon, 4326) "
        "USING geometry::geometry(Polygon, 4326)"
    )
