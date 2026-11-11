"""The Open-Meteo adapter: parsing, and the fetch-on-read throttle (CR-004)."""

import json
from datetime import UTC, datetime, timedelta

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
