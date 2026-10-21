#!/bin/sh
# Container entrypoint for the MetroFlow API engine.
#
# The schema is versioned with Alembic (see migrations/). Applying it here keeps
# `docker compose up` and the ZAP stack self-contained. In a multi-replica
# deployment migrations should instead run once as a separate job -- that is
# exactly what .github/workflows/supabase-migrate.yml does for the hosted
# Supabase database.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "[entrypoint] applying database migrations"
    alembic upgrade head
fi

exec "$@"
