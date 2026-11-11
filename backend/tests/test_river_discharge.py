"""The Open-Meteo Flood API adapter: parsing, and the fetch-on-read throttle (CR-004)."""

import json
from datetime import UTC, datetime, timedelta

import river_discharge


def _serve(monkeypatch, payload):
    """Point ``fetch_discharge`` at a canned Open-Meteo Flood API response."""

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

    monkeypatch.setattr(river_discharge, "urlopen", fake_urlopen)


def test_fetch_discharge_reads_today_and_its_p75(monkeypatch):
    _serve(
        monkeypatch,
        {
            "daily": {
                "time": ["2026-11-11"],
                "river_discharge": [3.06],
                "river_discharge_p75": [3.14],
            }
        },
    )
    assert river_discharge.fetch_discharge() == (3.06, 3.14)


def test_an_outage_returns_none_instead_of_raising(monkeypatch):
    _serve(monkeypatch, OSError("flood service unreachable"))
    assert river_discharge.fetch_discharge() is None
    _serve(monkeypatch, {"unexpected": "shape"})
    assert river_discharge.fetch_discharge() is None


def test_due_for_refresh_claims_the_slot_once_per_interval(monkeypatch):
    monkeypatch.setattr(river_discharge, "_last_fetch", None)
    assert river_discharge.due_for_refresh() is True
    assert river_discharge.due_for_refresh() is False  # a failed fetch counts too
    monkeypatch.setattr(river_discharge, "_last_fetch", datetime.now(UTC) - timedelta(minutes=21))
    assert river_discharge.due_for_refresh() is True


def test_fetch_discharge_forecast_reads_the_daily_series(monkeypatch):
    _serve(
        monkeypatch,
        {
            "daily": {
                "time": ["2026-11-11", "2026-11-12"],
                "river_discharge": [3.06, 2.93],
                "river_discharge_p75": [3.14, 3.23],
            }
        },
    )
    from datetime import date

    assert river_discharge.fetch_discharge_forecast() == [
        (date(2026, 11, 11), 3.06, 3.14),
        (date(2026, 11, 12), 2.93, 3.23),
    ]


def test_a_forecast_outage_returns_none_instead_of_raising(monkeypatch):
    _serve(monkeypatch, OSError("flood service unreachable"))
    assert river_discharge.fetch_discharge_forecast() is None


def test_cached_discharge_forecast_reuses_the_result_within_the_ttl(monkeypatch):
    monkeypatch.setattr(river_discharge, "_forecast_cache", None)
    calls = []

    def fake_fetch():
        calls.append(1)
        return [(datetime.now(UTC).date(), 1.0, 2.0)]

    monkeypatch.setattr(river_discharge, "fetch_discharge_forecast", fake_fetch)
    river_discharge.cached_discharge_forecast()
    river_discharge.cached_discharge_forecast()
    assert len(calls) == 1  # second call served from cache

    monkeypatch.setattr(
        river_discharge,
        "_forecast_cache",
        (datetime.now(UTC) - timedelta(minutes=31), [(datetime.now(UTC).date(), 1.0, 2.0)]),
    )
    river_discharge.cached_discharge_forecast()
    assert len(calls) == 2  # stale cache triggers a refetch
