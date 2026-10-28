import os
import pathlib
import sys

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
):
    os.environ.setdefault(_limit, "0")
