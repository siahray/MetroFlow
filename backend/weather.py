"""Live weather ingest for the rain gate (CR-004).

Open-Meteo is the system's live rain source: free, keyless, CC BY 4.0. It
feeds the same ``RAIN_GAUGE`` sensor interface the gateway posts through.

Fetch-on-read: ``GET /api/v1/flood-state`` refreshes the reading at most once
per refresh window, so there is no cron, no plan limit and no secret to
manage. A fetch failure is swallowed: the previous reading simply ages out of
the fresh window, and silence is never reported as rain.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime, timedelta
from urllib.request import Request, urlopen

# The virtual rain gauge. One point covers the pilot network: rain advisories
# are regional (PAGASA-style), so the gauge sits at the road network's own
# centre with a radius that reaches its farthest corner -- computed per
# network by ``coverage_for_extent`` below, so a re-imported network (the
# seed lattice in CI, Quezon City in production) is always fully covered.
# The constants are the fallback for an empty database, at the seed lattice's
# centre, which is what an un-imported deployment still has.
SENSOR_ID = "OPEN-METRO-RAIN"
CORRIDOR_LAT = 14.565
CORRIDOR_LON = 121.064
# Floor, not the coverage: ``coverage_for_extent`` grows this to reach the
# loaded network's corners. CR-004 needs "covered and quiet" to be
# distinguishable from "not covered".
IMPACT_RADIUS_M = 5000.0
# PAGASA classes anything from 0.1 mm/hr as rain. Use that boundary so a live
# drizzle raises a rain advisory instead of being read as silence.
RAIN_THRESHOLD_MM_HR = 0.1

# Display-only forecast (no routing/advisory effect): the next day's hourly
# rainfall outlook for the portal/driver "what's coming" card.
FORECAST_HOURS = 24


def coverage_for_extent(
    min_lat: float, min_lon: float, max_lat: float, max_lon: float
) -> tuple[float, float, float]:
    """``(lat, lon, radius_m)`` for one virtual gauge covering the whole extent.

    Centre of the bounding box, radius to its farthest corner plus 5% slack,
    floored at ``IMPACT_RADIUS_M`` so a tiny test grid keeps the old generous
    coverage. Pure, so the coverage rule itself is unit-testable without a
    database.
    """
    lat = (min_lat + max_lat) / 2
    lon = (min_lon + max_lon) / 2
    # Haversine to one corner (the box is symmetric about its centre).
    rad = math.radians
    d_lat = rad(max_lat - lat)
    d_lon = rad(max_lon - lon)
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(rad(lat)) * math.cos(rad(max_lat)) * math.sin(d_lon / 2) ** 2
    )
    corner_m = 2 * 6_371_000 * math.atan2(math.sqrt(h), math.sqrt(1 - h))
    return lat, lon, max(IMPACT_RADIUS_M, corner_m * 1.05)


def _current_url(lat: float, lon: float) -> str:
    return (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=precipitation&timezone=UTC"
    )


def _forecast_url(lat: float, lon: float) -> str:
    return (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&hourly=precipitation&forecast_hours={FORECAST_HOURS}&timezone=UTC"
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


def fetch_rain_rate(
    lat: float = CORRIDOR_LAT, lon: float = CORRIDOR_LON
) -> tuple[float, datetime] | None:
    """Current Open-Meteo precipitation as ``(mm in the preceding hour, UTC time)``.

    The API reports the preceding hour's total in mm, which as an hourly rate
    is the mean mm/hr over that hour. Returns ``None`` on any failure so a
    weather outage never fails the endpoint that triggered the ingest.
    """
    try:
        request = Request(
            _current_url(lat, lon), headers={"User-Agent": "MetroFlow flood advisory pilot"}
        )
        with urlopen(request, timeout=4) as response:
            payload = json.load(response)
        current = payload["current"]
        return (
            float(current["precipitation"]),
            datetime.fromisoformat(current["time"]).replace(tzinfo=UTC),
        )
    except (OSError, ValueError, KeyError, TypeError):
        return None


def fetch_rain_forecast(
    lat: float = CORRIDOR_LAT, lon: float = CORRIDOR_LON
) -> list[tuple[datetime, float]] | None:
    """Hourly ``(time, mm)`` for the next ``FORECAST_HOURS`` hours, or ``None`` on failure.

    Display-only (CR-004's resolver only ever reasons about current, fresh
    readings): this is the "what's coming" outlook, not a routing input.
    """
    try:
        request = Request(
            _forecast_url(lat, lon), headers={"User-Agent": "MetroFlow flood advisory pilot"}
        )
        with urlopen(request, timeout=4) as response:
            payload = json.load(response)
        hourly = payload["hourly"]
        return [
            (datetime.fromisoformat(t).replace(tzinfo=UTC), float(mm))
            for t, mm in zip(hourly["time"], hourly["precipitation"], strict=True)
        ]
    except (OSError, ValueError, KeyError, TypeError):
        return None


# A forecast barely moves minute to minute, so the display endpoint can serve a
# cached copy well past the rain-gate's own 10-minute ingest cadence.
_FORECAST_CACHE_TTL = timedelta(minutes=15)
_forecast_cache: tuple[datetime, list[tuple[datetime, float]] | None] | None = None


def cached_rain_forecast() -> list[tuple[datetime, float]] | None:
    """``fetch_rain_forecast``, reused for ``_FORECAST_CACHE_TTL`` before refetching."""
    global _forecast_cache
    now = datetime.now(UTC)
    if _forecast_cache is None or now - _forecast_cache[0] >= _FORECAST_CACHE_TTL:
        _forecast_cache = (now, fetch_rain_forecast())
    return _forecast_cache[1]


# Separate from the rain-gate ingest cadence above (`due_for_refresh`, which
# also writes a sensor reading): this is a read-only "what is it doing right
# now" value for a human-facing panel (the admin simulation toggle below), so
# it gets its own short cache instead of sharing that ingest's 10-minute gate.
_RAIN_RATE_CACHE_TTL = timedelta(minutes=2)
_rain_rate_cache: tuple[datetime, tuple[float, datetime] | None] | None = None


def cached_rain_rate() -> tuple[float, datetime] | None:
    """``fetch_rain_rate``, reused for ``_RAIN_RATE_CACHE_TTL`` before refetching."""
    global _rain_rate_cache
    now = datetime.now(UTC)
    if _rain_rate_cache is None or now - _rain_rate_cache[0] >= _RAIN_RATE_CACHE_TTL:
        _rain_rate_cache = (now, fetch_rain_rate())
    return _rain_rate_cache[1]


# WMO weather codes (https://open-meteo.com/en/docs), collapsed to the few
# buckets a one-line driver-facing summary needs -- not a full icon set.
_WEATHER_CODE_LABEL: list[tuple[range, str]] = [
    (range(0, 1), "Clear sky"),
    (range(1, 4), "Partly cloudy"),
    (range(45, 49), "Fog"),
    (range(51, 56), "Drizzle"),
    (range(56, 58), "Freezing drizzle"),
    (range(61, 66), "Rain"),
    (range(66, 68), "Freezing rain"),
    (range(71, 78), "Snow"),
    (range(80, 83), "Rain showers"),
    (range(85, 87), "Snow showers"),
    (range(95, 100), "Thunderstorm"),
]


def weather_code_label(code: int) -> str:
    """Short human label for a WMO weather code; unknown codes read as "Cloudy"."""
    for bucket, label in _WEATHER_CODE_LABEL:
        if code in bucket:
            return label
    return "Cloudy"


def _current_conditions_url(lat: float, lon: float) -> str:
    return (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code"
        "&hourly=precipitation_probability&forecast_hours=1"
        "&timezone=UTC"
    )


def fetch_current_conditions(lat: float, lon: float) -> dict | None:
    """Current temperature/humidity/wind/precipitation for the driver app's weather card.

    Same Open-Meteo source and corridor convention as the rain gate above,
    just more of the current-hour fields; display-only, like ``fetch_rain_forecast``.
    Returns ``None`` on any failure so a weather outage degrades to "unavailable".
    """
    try:
        request = Request(
            _current_conditions_url(lat, lon),
            headers={"User-Agent": "MetroFlow flood advisory pilot"},
        )
        with urlopen(request, timeout=4) as response:
            payload = json.load(response)
        current = payload["current"]
        probability = payload["hourly"]["precipitation_probability"][0]
        return {
            "temperature_c": float(current["temperature_2m"]),
            "humidity_pct": float(current["relative_humidity_2m"]),
            "precipitation_chance_pct": float(probability),
            "wind_kmh": float(current["wind_speed_10m"]),
            "description": weather_code_label(int(current["weather_code"])),
            "as_of": datetime.fromisoformat(current["time"]).replace(tzinfo=UTC),
        }
    except (OSError, ValueError, KeyError, IndexError, TypeError):
        return None


# Keyed per ~1km grid cell (2 decimal places) since this follows the driver's
# own device location rather than the fixed corridor gauge above.
_CURRENT_CONDITIONS_CACHE_TTL = timedelta(minutes=10)
_current_conditions_cache: dict[tuple[float, float], tuple[datetime, dict | None]] = {}


def cached_current_conditions(lat: float, lon: float) -> dict | None:
    """``fetch_current_conditions``, reused for ``_CURRENT_CONDITIONS_CACHE_TTL`` per grid cell."""
    key = (round(lat, 2), round(lon, 2))
    now = datetime.now(UTC)
    cached = _current_conditions_cache.get(key)
    if cached is None or now - cached[0] >= _CURRENT_CONDITIONS_CACHE_TTL:
        cached = (now, fetch_current_conditions(lat, lon))
        _current_conditions_cache[key] = cached
    return cached[1]
