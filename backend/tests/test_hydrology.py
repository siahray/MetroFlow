"""
Hydrology calibration tests.

These lock in the decision that the Red / SUBMERGED state must be reachable on
the 0-120 mm/hr slider. Before PONDING_AMPLIFICATION existed, peak simulated
depth was 15.6 cm -- below the smallest 20 cm clearance -- so an impassable road
could never be rendered at any slider position.

Elevations and PONDING_AMPLIFICATION were recalibrated 14 Nov 2026 for the
real OSM/Quezon City network (CR-007): the old 34-node demo lattice's ~5.5 m
elevation spread is gone, replaced by a real ~18 m spread (docs/TSD.md
LIM-028), and the old depression-factor coefficient (0.15) made that wider
spread's depth ratio too narrow to ever leave the Light flood band -- every
edge landed in the same colour regardless of rainfall. 80 cm is the "large
vehicle" clearance test below (was 60 cm): a wider real elevation spread
genuinely ponds deeper at its lowest point at peak rain, so the old 60 cm
benchmark no longer holds without changing what "large vehicle" means.
"""

import pytest

from config import settings
from hydrology import calculate_scs_cn_runoff, compute_node_water_depth
from routing import LIGHT_FLOOD, PASSABLE, SUBMERGED, classify_passability

ELEVATIONS = {
    1: 8.5,  # mid-high ground
    2: 4.2,  # low-lying
    3: 1.5,  # lowest point in the network
    4: 18.0,  # highest point in the network
}

CLEARANCES = (20.0, 35.0, 80.0)
RAINFALL_RANGE = (0, 15, 30, 45, 60, 75, 90, 105, 120)


def depth_at(rainfall_mm_hr, node_id):
    runoff = calculate_scs_cn_runoff(rainfall_mm_hr)
    return compute_node_water_depth(runoff, elevation_m=ELEVATIONS[node_id])


# ---------------------------------------------------------------------------
# Runoff model
# ---------------------------------------------------------------------------


def test_zero_rainfall_produces_no_runoff_or_ponding():
    assert calculate_scs_cn_runoff(0) == 0.0
    assert compute_node_water_depth(0.0, elevation_m=3.5) == 0.0


def test_runoff_is_monotonic_in_rainfall():
    values = [calculate_scs_cn_runoff(r) for r in RAINFALL_RANGE]
    assert values == sorted(values)
    assert values[0] == 0.0
    assert values[-1] > 0.0


def test_ponding_is_monotonic_in_runoff():
    depths = [compute_node_water_depth(q, elevation_m=3.5) for q in range(0, 80, 5)]
    assert depths == sorted(depths)


def test_lower_elevation_ponds_deeper():
    runoff = calculate_scs_cn_runoff(90)
    lowest = compute_node_water_depth(runoff, elevation_m=ELEVATIONS[3])
    highest = compute_node_water_depth(runoff, elevation_m=ELEVATIONS[4])
    assert lowest > highest


def test_depth_never_negative():
    assert compute_node_water_depth(-10.0, elevation_m=3.5) == 0.0


# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------


def test_amplification_is_overridable():
    runoff = calculate_scs_cn_runoff(120)
    baseline = compute_node_water_depth(runoff, elevation_m=3.5)
    doubled = compute_node_water_depth(
        runoff, elevation_m=3.5, amplification=settings.ponding_amplification * 2
    )
    # abs, not rel: compute_node_water_depth rounds to 2dp independently on
    # each call, so an exact pre-rounding 2x can land a cent off either way.
    assert doubled == pytest.approx(baseline * 2, abs=0.02)


def test_peak_depth_exceeds_smallest_clearance():
    """The whole point of the calibration: Red must be reachable."""
    peak = depth_at(120, 3)
    assert peak > CLEARANCES[0], f"peak {peak}cm never exceeds {CLEARANCES[0]}cm clearance"


def test_light_rain_is_fully_passable():
    for node_id in ELEVATIONS:
        assert classify_passability(depth_at(30, node_id), 20.0) == PASSABLE


def test_heavy_rain_submerges_low_lying_corridor_for_sedan():
    assert classify_passability(depth_at(120, 3), 20.0) == SUBMERGED
    assert classify_passability(depth_at(120, 2), 20.0) == SUBMERGED


def test_heavy_rain_still_passable_for_high_clearance_vehicle():
    assert classify_passability(depth_at(120, 3), 80.0) == LIGHT_FLOOD


def test_full_matrix_exercises_all_three_states():
    """Guards against a future calibration change collapsing a colour band."""
    seen = set()
    for rainfall in RAINFALL_RANGE:
        for clearance in CLEARANCES:
            for node_id in ELEVATIONS:
                seen.add(classify_passability(depth_at(rainfall, node_id), clearance))

    assert seen == {PASSABLE, LIGHT_FLOOD, SUBMERGED}


@pytest.mark.parametrize("clearance", CLEARANCES)
def test_depth_increases_with_rainfall_for_every_clearance(clearance):
    """Each clearance profile must show a dry -> flooded progression."""
    series = [depth_at(r, 3) for r in RAINFALL_RANGE]
    assert series == sorted(series)
    assert classify_passability(series[0], clearance) == PASSABLE
