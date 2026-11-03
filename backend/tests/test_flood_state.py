"""Source priority, freshness and the NOAH fallback (CR-004, TC-059 to TC-062)."""

from __future__ import annotations

from datetime import datetime, timedelta

import flood_state as fs
from flood_state import EdgeInputs, Observation, resolve

NOW = datetime(2026, 11, 3, 12, 0, 0)
WINDOW = timedelta(minutes=30)


def obs(source="SENSOR:RIVER-01", kind=fs.OBSERVED, age_min=5, flagged=True):
    return Observation(source, kind, NOW - timedelta(minutes=age_min), flagged)


def state(inputs: EdgeInputs, raining=False):
    return resolve(inputs, now=NOW, raining=raining, fresh_window=WINDOW)


def test_a_verified_hazard_beats_every_live_source_and_can_close_the_road():
    result = state(
        EdgeInputs(
            1, hazard_level="IMPASSABLE", hazard_blocks=True, live=(obs(),), noah_class="HIGH"
        ),
        raining=True,
    )
    assert result.basis == fs.VERIFIED_HAZARD
    assert result.closes_road is True


def test_a_caution_hazard_is_reported_but_does_not_close():
    result = state(EdgeInputs(1, hazard_level="CAUTION", hazard_blocks=False))
    assert result.basis == fs.VERIFIED_HAZARD
    assert result.closes_road is False


def test_a_fresh_flagged_reading_is_an_advisory_that_never_closes_a_road():
    result = state(EdgeInputs(1, live=(obs(),)))
    assert result.basis == fs.LIVE_ADVISORY
    assert result.advisory is True
    assert result.closes_road is False
    assert result.source == "SENSOR:RIVER-01"
    assert result.as_of == NOW - timedelta(minutes=5)
    assert result.has_live_data is True


def test_observed_beats_modelled_beats_simulated_and_newest_wins_within_a_kind():
    modelled = obs("OPEN_METEO:GLOFAS", fs.MODELLED, age_min=1)
    simulated = obs("SENSOR:SIM-1", fs.SIMULATED, age_min=1)
    old_observed = obs("SENSOR:A", fs.OBSERVED, age_min=20)
    new_observed = obs("SENSOR:B", fs.OBSERVED, age_min=2)

    assert state(EdgeInputs(1, live=(simulated, modelled))).source == "OPEN_METEO:GLOFAS"
    assert state(EdgeInputs(1, live=(modelled, old_observed))).source == "SENSOR:A"
    assert state(EdgeInputs(1, live=(old_observed, new_observed))).source == "SENSOR:B"


def test_a_modelled_value_is_labelled_so_the_apps_cannot_present_it_as_a_measurement():
    result = state(EdgeInputs(1, live=(obs("OPEN_METEO:GLOFAS", fs.MODELLED),)))
    assert result.kind == fs.MODELLED
    assert "Modelled value, not a measurement" in result.notes


def test_freshness_window_boundaries():
    assert fs.is_fresh(NOW - WINDOW, NOW, WINDOW) is True
    assert fs.is_fresh(NOW - WINDOW - timedelta(seconds=1), NOW, WINDOW) is False
    # A little clock skew into the future is tolerated, a long way is not.
    assert fs.is_fresh(NOW + timedelta(minutes=2), NOW, WINDOW) is True
    assert fs.is_fresh(NOW + timedelta(hours=2), NOW, WINDOW) is False


def test_a_stale_reading_is_ignored_and_never_reads_as_safe_or_as_a_flood():
    result = state(EdgeInputs(1, live=(obs(age_min=45),)))
    assert result.basis == fs.NONE
    assert result.advisory is False
    assert result.stale is True
    assert "A flagged reading is out of date and was ignored" in result.notes


def test_a_stale_reading_falls_back_to_noah_when_it_rains():
    result = state(EdgeInputs(1, live=(obs(age_min=45),), noah_class="MEDIUM"), raining=True)
    assert result.basis == fs.NOAH_CAUTION
    assert result.stale is True


def test_quiet_readings_mean_no_known_problem_but_live_data_exists():
    result = state(EdgeInputs(1, live=(obs(flagged=False),)))
    assert result.basis == fs.NONE
    assert result.has_live_data is True
    assert result.advisory is False


def test_no_data_at_all_says_so_instead_of_saying_safe():
    result = state(EdgeInputs(1))
    assert result.basis == fs.NONE
    assert result.has_live_data is False
    assert "No live data covers this segment" in result.notes


def test_noah_is_a_caution_with_a_penalty_only_while_it_rains():
    wet = state(EdgeInputs(1, noah_class="HIGH"), raining=True)
    assert wet.basis == fs.NOAH_CAUTION
    assert wet.advisory is True
    assert wet.route_penalty == fs.NOAH_PENALTY["HIGH"] > 1.0
    assert wet.kind == fs.STATIC

    dry = state(EdgeInputs(1, noah_class="HIGH"), raining=False)
    assert dry.basis == fs.NOAH_LAYER
    assert dry.advisory is False
    assert dry.route_penalty == 1.0


def test_noah_never_closes_a_road_at_any_class():
    for noah_class in ("LOW", "MEDIUM", "HIGH", "UNKNOWN"):
        assert state(EdgeInputs(1, noah_class=noah_class), raining=True).closes_road is False


def test_penalty_grows_with_susceptibility_and_an_unknown_class_adds_none():
    penalties = [
        state(EdgeInputs(1, noah_class=c), raining=True).route_penalty
        for c in ("LOW", "MEDIUM", "HIGH")
    ]
    assert penalties == sorted(penalties) and len(set(penalties)) == 3
    assert state(EdgeInputs(1, noah_class="UNKNOWN"), raining=True).route_penalty == 1.0


def test_a_fresh_live_advisory_outranks_noah():
    result = state(EdgeInputs(1, live=(obs(),), noah_class="HIGH"), raining=True)
    assert result.basis == fs.LIVE_ADVISORY
    assert result.route_penalty == 1.0
