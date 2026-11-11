"""Live weather ingest for the rain gate (CR-004).

PAGASA publishes bulletins, not an API (CR-004, open decision OD-D25), so the
interim live source is Open-Meteo: free, keyless, CC BY 4.0. It feeds the same
``RAIN_GAUGE`` sensor interface the gateway posts through, so PAGASA can
replace or join it later without redesign.

Fetch-on-read: ``GET /api/v1/flood-state`` refreshes the reading at most once
per refresh window, so there is no cron, no plan limit and no secret to
manage. A fetch failure is swallowed: the previous reading simply ages out of
the fresh window, and silence is never reported as rain.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from urllib.request import Request, urlopen

# The virtual rain gauge. One point covers the pilot corridor: the seed grid
# spans roughly 14.545-14.585 N, 121.048-121.080 E (about 4 x 3 km), and a
# PAGASA-style advisory is regional anyway.
SENSOR_ID = "OPEN-METRO-RAIN"
CORRIDOR_LAT = 14.565
CORRIDOR_LON = 121.064
# Generously covers the whole seed grid from its centre, so every segment
# reports live rain coverage -- CR-004 needs "covered and quiet" to be
# distinguishable from "not covered".
IMPACT_RADIUS_M = 5000.0
# PAGASA classes anything from 0.1 mm/hr as rain; 0.5 keeps traces out.
RAIN_THRESHOLD_MM_HR = 0.5

_API_URL = (
    "https://api.open-meteo.com/v1/forecast"
    f"?latitude={CORRIDOR_LAT}&longitude={CORRIDOR_LON}"
    "&current=precipitation&timezone=UTC"
)

# One poll per window is plenty: Open-Meteo's current values update every 15
# minutes, and the flood fresh window is 30.
_REFRESH_INTERVAL = timedelta(minutes=10)
_last_fetch: datetime | None = None


def due_for_refresh() -> bool:
    """True at most once per refresh interval; a failed fetch counts too.

    Claiming the slot up front means a broken API is not hammered on every
    poll. Two concurrent requests can both win the race; that only duplicates
    a reading row, and the advisory upsert keeps the newest one.
    """
    global _last_fetch
    now = datetime.now(UTC)
    if _last_fetch is None or now - _last_fetch >= _REFRESH_INTERVAL:
        _last_fetch = now
        return True
    return False


def fetch_rain_rate() -> tuple[float, datetime] | None:
    """Current Open-Meteo precipitation as ``(mm in the preceding hour, UTC time)``.

    The API reports the preceding hour's total in mm, which as an hourly rate
    is the mean mm/hr over that hour. Returns ``None`` on any failure so a
    weather outage never fails the endpoint that triggered the ingest.
    """
    try:
        request = Request(_API_URL, headers={"User-Agent": "MetroFlow flood advisory pilot"})
        with urlopen(request, timeout=4) as response:
            payload = json.load(response)
        current = payload["current"]
        return (
            float(current["precipitation"]),
            datetime.fromisoformat(current["time"]).replace(tzinfo=UTC),
        )
    except (OSError, ValueError, KeyError, TypeError):
        return None
