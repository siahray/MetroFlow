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
