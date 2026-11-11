import os
import pathlib
import sys

import pytest

# Make the backend package modules (config, routing, hydrology, ...) importable
# when pytest is invoked from the repository root.
BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# The request ceilings (TSD LIM-006) are sized for people, and the suite is not
# people: the autouse network reset alone triggers the simulation once per test.
# Switch the defaults off here so a growing suite cannot start failing on its own
# throughput, and exercise the limiter explicitly in test_rate_limit.py instead.
# ``setdefault`` respects a value an operator exported on purpose.
for _limit in (
    "METROFLOW_RATE_LIMIT_LOGIN_PER_MIN",
    "METROFLOW_RATE_LIMIT_REGISTER_PER_MIN",
    "METROFLOW_RATE_LIMIT_SOS_PER_MIN",
    "METROFLOW_RATE_LIMIT_SIMULATION_PER_MIN",
    "METROFLOW_RATE_LIMIT_REPORTS_PER_MIN",
    # The flood-state endpoint would otherwise reach api.open-meteo.com from
    # the suite: network-dependent, and it would flag every seeded edge.
    "METROFLOW_WEATHER_INGEST",
):
    os.environ.setdefault(_limit, "0")


def pytest_collection_modifyitems(config, items):
    """Refuse to run integration tests against a non-local database.

    They create and dispatch real rows (SOS requests, vehicles, audit logs); run
    against the hosted Supabase DB they leak into the dispatcher portal.
    """
    # pytest.ini deselects them by default; only a `-m integration` run writes.
    if "not integration" in (config.getoption("-m") or "") or not any(
        "integration" in item.keywords for item in items
    ):
        return
    from dotenv import load_dotenv

    load_dotenv(BACKEND_ROOT / ".env")
    url = os.getenv("DATABASE_URL", "")
    if os.getenv("METROFLOW_ALLOW_REMOTE_TEST_DB") or any(
        host in url for host in ("@localhost", "@127.0.0.1", "@db:", "@postgres:")
    ):
        return
    raise pytest.UsageError(
        "Integration tests write to DATABASE_URL, which is not local. Point it at a "
        "throwaway PostGIS, or set METROFLOW_ALLOW_REMOTE_TEST_DB=1 to override."
    )
