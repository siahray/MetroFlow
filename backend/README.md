# MetroFlow API

FastAPI service over PostGIS. It owns the database connection and issues its own
HS256 session tokens; neither client talks to Supabase directly (ADR-021 in
`../docs/TSD.md`).

## Run it locally

PostgreSQL 15 with PostGIS, from the compose file at the repo root (`postgres`
there is the `metroflow_postgis` container the commands below use):

```bash
docker compose up -d postgres
```

```bash
cd backend
python3 -m venv venv                 # if you have no venv yet
venv/bin/pip install -r requirements-dev.txt
cp .env.example .env                 # DATABASE_URL, JWT_SECRET, ...
venv/bin/alembic upgrade head        # the app never calls create_all
venv/bin/uvicorn main:app --reload
```

`DATABASE_URL` is read from the environment first and only then from `.env`, so
any command below can be pointed at another database by prefixing the variable.

## Tests

```bash
cd backend
venv/bin/python -m pytest           # unit only (pytest.ini deselects integration)
venv/bin/python -m pytest -m integration   # needs the PostGIS above
```

The integration suite creates real rows — SOS requests, vehicles, hazards, audit
entries — and leaves them behind, so do not run it against a database whose data
you care about. `tests/conftest.py` refuses a non-local `DATABASE_URL` for exactly
that reason: it only accepts `@localhost`, `@127.0.0.1`, `@db:` or `@postgres:`,
and `METROFLOW_ALLOW_REMOTE_TEST_DB=1` overrides the check for a disposable remote
database.

### Throwaway database

The dev database accumulates this suite's rows and can drift behind the migration
history, which is the fastest way to spend an afternoon debugging test failures
that live in the data rather than the code. Run the suite against a fresh database
instead (from `backend/`):

```bash
docker exec metroflow_postgis psql -U metroflow_admin -d postgres \
  -c "DROP DATABASE IF EXISTS metroflow_ci" -c "CREATE DATABASE metroflow_ci"

export DATABASE_URL="postgresql+psycopg2://metroflow_admin:metroflow_password@localhost:5432/metroflow_ci"
venv/bin/alembic upgrade head
venv/bin/python -m pytest -m integration

docker exec metroflow_postgis psql -U metroflow_admin -d postgres \
  -c "DROP DATABASE metroflow_ci"
```

The whole run takes about 20 seconds (80 tests). `alembic check` additionally
fails when `models.py` changed without a matching revision — CI runs it, and it is
cheap to run before pushing.
