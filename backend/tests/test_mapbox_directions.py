"""The Mapbox Directions adapter: URL construction and failure handling."""

import mapbox_directions


def _capture(monkeypatch):
    """Record every requested URL, then fail the request (adapter returns None)."""
    requested: list[str] = []

    def fake_urlopen(request, timeout=None):
        requested.append(request.full_url)
        raise OSError("offline")

    monkeypatch.setattr(mapbox_directions, "urlopen", fake_urlopen)
    return requested


def test_coordinates_are_formatted_and_out_of_range_ones_never_reach_the_url(monkeypatch):
    requested = _capture(monkeypatch)

    assert mapbox_directions.fetch_driving_route(14.5, 121.0, 14.6, 121.1, "tok") is None
    assert "driving/121.000000,14.500000;121.100000,14.600000" in requested[0]

    for bad in (float("nan"), float("inf"), 91.0, -1e9):
        assert mapbox_directions.fetch_driving_route(bad, 121.0, 14.6, 121.1, "tok") is None
    assert len(requested) == 1  # refused before any request was made
