"""Mapbox Directions API for the dry-state ("FASTEST") routing personality.

Called only when ``routing.routing_mode`` has already decided that every edge
in the graph is clear -- no water, advisory or closure anywhere (see
``main.py::get_optimal_route``). A real road network and live traffic serve a
plain fastest path better than our own graph, which exists to carry flood
state, not drive quality. ``FLOOD_SAFE`` routing never calls this: only the
in-house TD-A* engine knows about water depth and vehicle clearance.

Fetch-on-request, no caching: unlike the weather/river adapters this is not
polled on a timer, only when a driver actually asks for a route. A failure
here (network, malformed response, no route found) returns ``None`` so the
caller falls back to the in-house TD-A* result -- Mapbox being unreachable
must never fail a route request.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.request import Request, urlopen

_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving/{coords}"

# Mapbox's (maneuver.type, maneuver.modifier) mapped onto this project's own
# manoeuvre vocabulary (routing.py's DEPART/TURN_LEFT/etc.,
# schemas.RouteInstruction.manoeuvre).
_LEFT_MODIFIERS = {"left", "sharp left"}
_RIGHT_MODIFIERS = {"right", "sharp right"}


@dataclass
class MapboxStep:
    manoeuvre: str
    road_name: str | None
    distance_m: float
    text: str


@dataclass
class MapboxRoute:
    geometry: dict[str, Any]  # GeoJSON LineString, already [longitude, latitude]
    distance_m: float
    duration_s: float
    steps: list[MapboxStep]


def _manoeuvre_for(maneuver_type: str, modifier: str | None) -> str:
    if maneuver_type == "depart":
        return "DEPART"
    if maneuver_type == "arrive":
        return "ARRIVE"
    if modifier == "uturn":
        return "U_TURN"
    if modifier == "slight left":
        return "SLIGHT_LEFT"
    if modifier == "slight right":
        return "SLIGHT_RIGHT"
    if modifier in _LEFT_MODIFIERS:
        return "TURN_LEFT"
    if modifier in _RIGHT_MODIFIERS:
        return "TURN_RIGHT"
    return "STRAIGHT"


def fetch_driving_route(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    access_token: str,
) -> MapboxRoute | None:
    """One Directions API call: driving profile, full geometry and steps.

    Returns ``None`` on any failure (network, non-200, malformed payload, or
    no route in the response) so the caller can fall back to the in-house
    engine without special-casing each failure mode.
    """
    coords = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    url = (
        _DIRECTIONS_URL.format(coords=coords)
        + f"?geometries=geojson&steps=true&overview=full&access_token={access_token}"
    )
    try:
        request = Request(url, headers={"User-Agent": "MetroFlow flood advisory pilot"})
        with urlopen(request, timeout=5) as response:
            payload = json.load(response)
        route = payload["routes"][0]
        leg = route["legs"][0]
        steps: list[MapboxStep] = []
        for step in leg["steps"]:
            maneuver = step["maneuver"]
            steps.append(
                MapboxStep(
                    manoeuvre=_manoeuvre_for(maneuver["type"], maneuver.get("modifier")),
                    road_name=step.get("name") or None,
                    distance_m=float(step["distance"]),
                    text=maneuver.get("instruction") or "Continue",
                )
            )
        return MapboxRoute(
            geometry=route["geometry"],
            distance_m=float(route["distance"]),
            duration_s=float(route["duration"]),
            steps=steps,
        )
    except (OSError, ValueError, KeyError, IndexError, TypeError):
        return None
