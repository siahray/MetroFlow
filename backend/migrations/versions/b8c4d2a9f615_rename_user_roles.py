"""rename_user_roles

Revision ID: b8c4d2a9f615
Revises: a7d3f1c9b204
Create Date: 2026-11-14

The role model was named after job titles (LGU_DISPATCHER, EMERGENCY_DRIVER)
rather than the actual four roles the project uses: Super Admin (Head) and
Admin (Dispatcher) on the portal, Responders and Public Drivers on the
driver app. LGU_DISPATCHER becomes ADMIN; EMERGENCY_DRIVER splits into
RESPONDER (an account linked to a rescue unit) and PUBLIC_DRIVER (every
other driver account, the general-public case the app was actually designed
for) -- the only distinguishing signal that already existed on the row.
SUPER_ADMIN is unchanged.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b8c4d2a9f615"
down_revision: str | Sequence[str] | None = "a7d3f1c9b204"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

users = sa.table(
    "users",
    sa.column("role", sa.String),
    sa.column("vehicle_id", sa.Integer),
)


def upgrade() -> None:
    op.execute(users.update().where(users.c.role == "LGU_DISPATCHER").values(role="ADMIN"))
    op.execute(
        users.update()
        .where(sa.and_(users.c.role == "EMERGENCY_DRIVER", users.c.vehicle_id.is_not(None)))
        .values(role="RESPONDER")
    )
    op.execute(
        users.update()
        .where(sa.and_(users.c.role == "EMERGENCY_DRIVER", users.c.vehicle_id.is_(None)))
        .values(role="PUBLIC_DRIVER")
    )


def downgrade() -> None:
    op.execute(users.update().where(users.c.role == "ADMIN").values(role="LGU_DISPATCHER"))
    op.execute(
        users.update()
        .where(users.c.role.in_(["RESPONDER", "PUBLIC_DRIVER"]))
        .values(role="EMERGENCY_DRIVER")
    )
