#!/usr/bin/env bash
# MetroFlow hosted-database backup (NFR-016 / BACKLOG S-4).
#
# The Supabase project is on the free tier, which has NO managed backups
# (verified 10 Nov 2026: GET /v1/projects/{ref}/database/backups returns an
# empty list, pitr_enabled=false). This script is the backup mechanism:
# a custom-format pg_dump of the public schema, written to backups/ which is
# git-ignored because dumps contain live data.
#
# Requires: libpq (pg_dump) on PATH — `brew install libpq` — and DATABASE_URL
# in backend/.env or the environment. Point-in-time recovery is a paid tier
# (ADR-002); without it the RPO is the age of the newest dump in backups/.
#
# Usage: scripts/backup-db.sh [output-dir]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/backups}"
mkdir -p "$OUT"

# Load backend/.env for DATABASE_URL without printing it.
if [ -z "${DATABASE_URL:-}" ] && [ -f "$ROOT/backend/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/backend/.env"
  set +a
fi
: "${DATABASE_URL:?DATABASE_URL is not set}"

# SQLAlchemy-style URLs are not valid libpq URIs; strip the dialect suffix.
DBURL="${DATABASE_URL/postgresql+psycopg2/postgresql}"
DBURL="${DBURL/postgresql+psycopg/postgresql}"

PG_DUMP="$(command -v pg_dump || echo /opt/homebrew/opt/libpq/bin/pg_dump)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$OUT/metroflow-prod-$STAMP.dump"

# public only: the dump must not touch Supabase-managed schemas (auth,
# storage, realtime), which the app role cannot read anyway.
"$PG_DUMP" "$DBURL" -F c -n public -f "$DEST"
ls -lh "$DEST"

# Retention: keep the newest 14 dumps so backups/ cannot grow without bound.
# 14 days covers two missed nightly runs plus a weekend of manual restores.
ls -1t "$OUT"/metroflow-prod-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "Backup written. RPO is now the age of this file — keep dumps off-site."
