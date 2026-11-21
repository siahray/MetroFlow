"""The Open-Meteo adapter: parsing, and the fetch-on-read throttle (CR-004)."""

import json
from datetime import UTC, datetime, timedelta

import pytest

import weather


def _serve(monkeypatch, payload):
    """Point ``fetch_rain_rate`` at a canned Open-Meteo response."""

    class _Response:
        def __init__(self, body):
            self._body = body

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return self._body

    def fake_urlopen(request, timeout=None):
        if isinstance(payload, Exception):
            raise payload
        return _Response(json.dumps(payload).encode())

    monkeypatch.setattr(weather, "urlopen", fake_urlopen)


def test_fetch_rain_rate_reads_the_current_precipitation(monkeypatch):
    _serve(monkeypatch, {"current": {"time": "2026-11-11T04:00", "precipitation": 2.5}})
    rate, as_of = weather.fetch_rain_rate()
    assert rate == 2.5
    assert as_of == datetime(2026, 11, 11, 4, 0, tzinfo=UTC)


def test_a_weather_outage_returns_none_instead_of_raising(monkeypatch):
    _serve(monkeypatch, OSError("weather service unreachable"))
    assert weather.fetch_rain_rate() is None
    _serve(monkeypatch, {"unexpected": "shape"})
    assert weather.fetch_rain_rate() is None


def test_due_for_refresh_claims_the_slot_once_per_interval(monkeypatch):
    monkeypatch.setattr(weather, "_last_fetch", None)
    assert weather.due_for_refresh() is True
    assert weather.due_for_refresh() is False  # a failed fetch counts too
    monkeypatch.setattr(weather, "_last_fetch", datetime.now(UTC) - timedelta(minutes=11))
    assert weather.due_for_refresh() is True


def test_fetch_rain_forecast_reads_the_hourly_series(monkeypatch):
    _serve(
        monkeypatch,
        {"hourly": {"time": ["2026-11-11T15:00", "2026-11-11T16:00"], "precipitation": [0.0, 2.5]}},
    )
    hourly = weather.fetch_rain_forecast()
    assert hourly == [
        (datetime(2026, 11, 11, 15, 0, tzinfo=UTC), 0.0),
        (datetime(2026, 11, 11, 16, 0, tzinfo=UTC), 2.5),
    ]


def test_a_forecast_outage_returns_none_instead_of_raising(monkeypatch):
    _serve(monkeypatch, OSError("weather service unreachable"))
    assert weather.fetch_rain_forecast() is None


def test_cached_rain_forecast_reuses_the_result_within_the_ttl(monkeypatch):
    monkeypatch.setattr(weather, "_forecast_cache", None)
    calls = []

    def fake_fetch():
        calls.append(1)
        return [(datetime.now(UTC), 1.0)]

    monkeypatch.setattr(weather, "fetch_rain_forecast", fake_fetch)
    weather.cached_rain_forecast()
    weather.cached_rain_forecast()
    assert len(calls) == 1  # second call served from cache

    monkeypatch.setattr(
        weather,
        "_forecast_cache",
        (datetime.now(UTC) - timedelta(minutes=16), [(datetime.now(UTC), 1.0)]),
    )
    weather.cached_rain_forecast()
    assert len(calls) == 2  # stale cache triggers a refetch


def test_current_conditions_url_rejects_non_finite_or_out_of_range_coordinates():
    for lat, lon in [
        (float("nan"), 121.064),
        (14.565, float("inf")),
        (90.1, 121.064),
        (14.565, -180.1),
    ]:
        with pytest.raises(ValueError):
            weather._current_conditions_url(lat, lon)


def test_fetch_current_conditions_returns_none_for_invalid_coordinates(monkeypatch):
    assert weather.fetch_current_conditions(float("nan"), 121.064) is None
    assert weather.fetch_current_conditions(999, 121.064) is None


def test_fetch_current_conditions_reads_the_current_fields(monkeypatch):
    _serve(
        monkeypatch,
        {
            "current": {
                "time": "2026-11-21T04:00",
                "temperature_2m": 28.0,
                "relative_humidity_2m": 80.0,
                "wind_speed_10m": 12.0,
                "weather_code": 61,
            },
            "hourly": {"precipitation_probability": [52]},
        },
    )
    conditions = weather.fetch_current_conditions(14.565, 121.064)
    assert conditions == {
        "temperature_c": 28.0,
        "humidity_pct": 80.0,
        "precipitation_chance_pct": 52.0,
        "wind_kmh": 12.0,
        "description": "Rain",
        "as_of": datetime(2026, 11, 21, 4, 0, tzinfo=UTC),
    }


def test_coverage_for_extent_centres_the_gauge_on_the_loaded_network():
    # The seed lattice (CI): centre 14.565 / 121.064, farthest corner ~2.9 km,
    # inside the 5 km floor -- the old fixed gauge already covered it.
    lat, lon, radius_m = weather.coverage_for_extent(14.545, 121.048, 14.585, 121.080)
    assert lat == pytest.approx(14.565)
    assert lon == pytest.approx(121.064)
    assert radius_m == pytest.approx(weather.IMPACT_RADIUS_M)

    # A re-imported real network is wider than the floor, so the radius has to
    # grow to keep every corner covered -- the bug this function exists for.
    _, _, wide_radius_m = weather.coverage_for_extent(14.55, 120.98, 14.80, 121.15)
    assert wide_radius_m > weather.IMPACT_RADIUS_M
