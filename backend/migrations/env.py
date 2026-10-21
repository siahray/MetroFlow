"""
Alembic environment for MetroFlow.

The connection string always comes from ``DATABASE_URL`` -- the same variable
``database.py`` reads -- so the local PostGIS container, CI, and the hosted
Supabase database all run the exact same migration history.
"""

from logging.config import fileConfig

from alembic import context
from geoalchemy2 import Geometry
from sqlalchemy import engine_from_config, pool

import models  # noqa: F401  (imported for the side effect of registering tables)
from database import DATABASE_URL, Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Alembic's ConfigParser treats '%' as interpolation, so escape it for URLs
# with percent-encoded passwords (common on hosted Postgres).
config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))

target_metadata = Base.metadata

# Objects owned by PostGIS itself. ``CREATE EXTENSION postgis`` creates these in
# the public schema, and autogenerate would otherwise propose dropping them
# because they are absent from the SQLAlchemy metadata.
POSTGIS_MANAGED_TABLES = {"spatial_ref_sys"}


def include_object(object_, name, type_, reflected, compare_to):
    """Keep foreign objects out of autogenerate and ``alembic check``.

    Reflection follows ``search_path``, so on the PostGIS image (whose
    search_path is ``public, topology, tiger``) and on Supabase (which keeps
    extensions in ``extensions``) Alembic sees tables this project does not own
    and would otherwise propose dropping all of them.

    The rule is therefore: only manage tables declared in ``Base.metadata``.
    Consequence worth knowing: removing a model does not generate a DROP; that
    is written by hand in the revision.
    """
    if type_ == "table":
        if name in POSTGIS_MANAGED_TABLES:
            return False
        if reflected and name not in Base.metadata.tables:
            return False
    if type_ == "index" and reflected:
        table = getattr(object_, "table", None)
        if table is not None and table.name not in Base.metadata.tables:
            return False
    return True


def render_item(type_, obj, autogen_context):
    """Render GeoAlchemy2 columns instead of failing on an unknown type."""
    if type_ == "type" and isinstance(obj, Geometry):
        autogen_context.imports.add("import geoalchemy2")
        return f"geoalchemy2.Geometry(geometry_type={obj.geometry_type!r}, srid={obj.srid})"
    return False


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of executing it (``alembic upgrade --sql``)."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_item=render_item,
        include_object=include_object,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_item=render_item,
            include_object=include_object,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
