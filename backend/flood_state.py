"""Flood state per road segment: which source wins, and how fresh it is (CR-004).

This module is a pure function of its inputs, so the rules can be tested without a
database or a clock. Routing does not read it yet: the first consumer is
``GET /api/v1/flood-state``, which tells dispatchers and drivers *why* a segment is
flagged, by whom, and as of when.

Priority, from CR-004 section 3.3. The first applicable rule wins:

1. A verified hazard (published by a dispatcher). It already drives routing.
2. A **fresh** live observation that is over its threshold: an observed gauge
   reading beats a modelled river value, which beats a simulated sensor. Always
   advisory: it never closes a road (BRULE-012, BRULE-016).
3. (Verified satellite observation: CR-003, not built yet.)
4. Project NOAH as a fallback, only **while it is raining**: a caution and a route
   cost penalty, never a closure. With no rain the NOAH layer is information only.

Missing data is never "safe": a segment with nothing flagged reports ``NONE`` and
whether any live source covers it, and a stale reading is ignored but remembered so
the apps can say so.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

# --- Vocabulary -------------------------------------------------------------

# What kind of knowledge a value is. The apps must never show a modelled value as a
# measurement, so every state carries one of these.
OBSERVED = "OBSERVED"  # a gauge reading
MODELLED = "MODELLED"  # a model output, e.g. GloFAS river discharge
SIMULATED = "SIMULATED"  # a pilot-generated sensor value
STATIC = "STATIC"  # a fixed map layer, e.g. NOAH scenarios

# Lower number wins among live observations (CR-004 priorities 2a, 2b).
_KIND_RANK = {OBSERVED: 0, MODELLED: 1, SIMULATED: 2}

# What the segment's state is based on.
VERIFIED_HAZARD = "VERIFIED_HAZARD"
LIVE_ADVISORY = "LIVE_ADVISORY"
NOAH_CAUTION = "NOAH_CAUTION"
NOAH_LAYER = "NOAH_LAYER"
NONE = "NONE"

# Route cost multiplier for the NOAH fallback, by susceptibility class. A penalty makes
# the router prefer another road when one exists; it never removes a road.
NOAH_PENALTY = {"LOW": 1.1, "MEDIUM": 1.3, "HIGH": 1.6}

DEFAULT_FRESH_WINDOW = timedelta(minutes=30)
CLOCK_SKEW = timedelta(minutes=5)


@dataclass(frozen=True)
class Observation:
    """One live reading that covers a segment."""

    source: str  # e.g. "SENSOR:RIVER-01"
    kind: str  # OBSERVED, MODELLED or SIMULATED
    as_of: datetime  # when the value applies, not when we received it
    flagged: bool  # over its threshold


@dataclass(frozen=True)
class EdgeInputs:
    edge_id: int
    # Highest-severity verified hazard covering the edge, and whether it blocks.
    hazard_level: str | None = None
    hazard_blocks: bool = False
    live: tuple[Observation, ...] = ()
    noah_class: str | None = None  # "LOW", "MEDIUM" or "HIGH"


@dataclass(frozen=True)
class FloodState:
    edge_id: int
    basis: str
    source: str | None = None
    kind: str | None = None
    as_of: datetime | None = None
    # True when a live source covers this edge, even if nothing is flagged.
    has_live_data: bool = False
    # True when the segment has a flagged reading that is too old to trust.
    stale: bool = False
    advisory: bool = False
    closes_road: bool = False
    route_penalty: float = 1.0
    notes: list[str] = field(default_factory=list)


def is_fresh(as_of: datetime, now: datetime, window: timedelta) -> bool:
    """A reading is live for ``window`` after the time it applies to.

    A few minutes of clock skew in the future is tolerated; a timestamp far ahead of
    now is not trusted.
    """
    return -CLOCK_SKEW <= now - as_of <= window


def resolve(
    inputs: EdgeInputs,
    *,
    now: datetime,
    raining: bool,
    fresh_window: timedelta = DEFAULT_FRESH_WINDOW,
) -> FloodState:
    """Pick the state of one segment from everything known about it."""
    has_live = bool(inputs.live)

    # 1. A verified hazard decides, and routing already honours it.
    if inputs.hazard_level:
        return FloodState(
            edge_id=inputs.edge_id,
            basis=VERIFIED_HAZARD,
            source=f"HAZARD:{inputs.hazard_level}",
            kind=OBSERVED,
            has_live_data=has_live,
            closes_road=inputs.hazard_blocks,
            notes=["Published by a dispatcher"],
        )

    # 2. The best fresh, flagged live observation. Stale ones are ignored but remembered.
    flagged = [o for o in inputs.live if o.flagged]
    fresh = [o for o in flagged if is_fresh(o.as_of, now, fresh_window)]
    stale = [o for o in flagged if o not in fresh]
    if fresh:
        best = min(fresh, key=lambda o: (_KIND_RANK.get(o.kind, 9), -o.as_of.timestamp()))
        return FloodState(
            edge_id=inputs.edge_id,
            basis=LIVE_ADVISORY,
            source=best.source,
            kind=best.kind,
            as_of=best.as_of,
            has_live_data=True,
            advisory=True,
            notes=[
                "Advisory until a dispatcher confirms it",
                *(["Modelled value, not a measurement"] if best.kind == MODELLED else []),
                *(["Simulated sensor"] if best.kind == SIMULATED else []),
            ],
        )

    notes = ["A flagged reading is out of date and was ignored"] if stale else []

    # 4. NOAH fallback: a caution while it rains, information otherwise.
    if inputs.noah_class:
        if raining:
            return FloodState(
                edge_id=inputs.edge_id,
                basis=NOAH_CAUTION,
                source="NOAH",
                kind=STATIC,
                has_live_data=has_live,
                stale=bool(stale),
                advisory=True,
                route_penalty=NOAH_PENALTY.get(inputs.noah_class.upper(), 1.0),
                notes=[*notes, "Modelled flood-prone area, not an observed flood"],
            )
        return FloodState(
            edge_id=inputs.edge_id,
            basis=NOAH_LAYER,
            source="NOAH",
            kind=STATIC,
            has_live_data=has_live,
            stale=bool(stale),
            notes=[*notes, "Flood-prone area (map layer only; it is not raining)"],
        )

    # Nothing flagged. This is "no known problem", not "safe".
    return FloodState(
        edge_id=inputs.edge_id,
        basis=NONE,
        has_live_data=has_live,
        stale=bool(stale),
        notes=notes if has_live else [*notes, "No live data covers this segment"],
    )
