"""Live GloFAS river discharge for the pilot corridor (CR-004 revision 1.1,
FSD-FR-117).

Open-Meteo's Flood API serves the GloFAS v4 model: a modelled daily discharge
value, not a gauge reading, so every value this feeds in is labelled
MODELLED and only ever advisory (BRULE-016) -- it can flag a road, never
close one. Same free, keyless, CC BY 4.0 terms as weather.py's rain feed.

Fetch-on-read like weather.py: GET /api/v1/flood-state refreshes the reading
at most once per refresh window, so there is no cron, no plan limit and no
secret to manage. A fetch failure is swallowed: the previous reading simply
ages out of the fresh window, and silence is never reported as a flood.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from urllib.request import Request, urlopen

# The pilot river point. Several nearby requests across the Marikina/Pasig
# system all snap to the same GloFAS grid cell at this corner of the pilot
# bbox (grid spacing is roughly 0.05 deg, ~5 km -- coarse, per LIM-027), which
# is also Metro Manila's major flood-prone basin and PAGASA's own monitored
# river (CR-004 section 1).
SENSOR_ID = "OPEN-METRO-RIVER-DISCHARGE"
RIVER_LAT = 14.60
RIVER_LON = 121.095
RIVER_NAME = "Marikina/Pasig River (GloFAS modelled discharge)"

# Riverside roads in range of an overflow, narrower than the rain gauge's
# whole-corridor radius; there is no bank geometry to measure against yet.
IMPACT_RADIUS_M = 1500.0

_API_URL = (
    "https://flood-api.open-meteo.com/v1/flood"
    f"?latitude={RIVER_LAT}&longitude={RIVER_LON}"
    "&daily=river_discharge,river_discharge_p75&forecast_days=1&past_days=0"
)

# GloFAS updates once a day, so there is no rush, but polling every 20
# minutes keeps the reading comfortably inside the 30-minute flood fresh
# window with margin to spare, well under Open-Meteo's ~10k/day fair-use
# guideline (CR-004 OD-D26).
_REFRESH_INTERVAL = timedelta(minutes=20)
_last_fetch: datetime | None = None


def due_for_refresh() -> bool:
    """True at most once per refresh interval; a failed fetch counts too (see weather.py)."""
    global _last_fetch
    now = datetime.now(UTC)
    if _last_fetch is None or now - _last_fetch >= _REFRESH_INTERVAL:
        _last_fetch = now
        return True
    return False


def fetch_discharge() -> tuple[float, float] | None:
    """Today's ``(river_discharge, river_discharge_p75)`` in m^3/s, or ``None`` on failure.

    ``river_discharge_p75`` is the model's own historical 75th-percentile flow
    for this day of year: the open-source stand-in for a PAGASA Alert level
    until OD-D25 is resolved (CR-004 TC-065 -- advisory only, labelled
    modelled, never a closure).

    GloFAS has no sub-daily reading to timestamp, so the caller stamps this
    with the time it fetched it, not the daily value's own date -- freshness
    here tracks "we checked recently", not observation recency.
    """
    try:
        request = Request(_API_URL, headers={"User-Agent": "MetroFlow flood advisory pilot"})
        with urlopen(request, timeout=4) as response:
            payload = json.load(response)
        daily = payload["daily"]
        return float(daily["river_discharge"][0]), float(daily["river_discharge_p75"][0])
    except (OSError, ValueError, KeyError, IndexError, TypeError):
        return None
