"""
Routing engine tests.

The fuzz test below is the regression guard for the inadmissible-heuristic bug:
the old implementation divided the heuristic by a hardcoded 50 km/h while edge 1
permits 60 km/h, so A* could overestimate remaining cost and prune the true
shortest path (measured: 8 suboptimal results in 48,000 cases).
"""

import heapq
import itertools
import math
import random

import pytest

from routing import (
    ADVISORY_PENALTY,
    ARRIVE,
    DEPART,
    LIGHT_FLOOD,
    PASSABLE,
    SLIGHT_LEFT,
    SLIGHT_RIGHT,
    STRAIGHT,
    SUBMERGED,
    TURN_LEFT,
    TURN_RIGHT,
    U_TURN,
    bearing_degrees,
    build_instructions,
    classify_passability,
    classify_turn,
    compass_point,
    hazard_blocks,
    td_a_star_search,
)

NODES = {
    1: (14.5491, 121.0553),
    2: (14.5583, 121.0581),
    3: (14.5672, 121.0631),
    4: (14.5731, 121.0685),
}

# (start_node_id, end_node_id, distance_m, max_speed_kmh) -- mirrors the seed.
EDGES = [
    (1, 2, 1100.0, 60.0),
    (2, 3, 1000.0, 50.0),
    (3, 4, 850.0, 50.0),
    (1, 4, 2800.0, 40.0),
]

CLEARANCE = 30.0


def build_graph(depths, bidirectional=True):
    graph = {}
    for (u, v, length, speed), depth in zip(EDGES, depths, strict=False):
        graph.setdefault(u, []).append((v, length, speed, depth, False))
        if bidirectional:
            graph.setdefault(v, []).append((u, length, speed, depth, False))
    return graph


def dijkstra(graph, start, target, clearance=CLEARANCE):
    """Reference implementation of the same cost model, without a heuristic."""
    distances = {start: 0.0}
    pq = [(0.0, start)]
    settled = set()

    while pq:
        cost, node = heapq.heappop(pq)
        if node in settled:
            continue
        settled.add(node)
        if node == target:
            return cost

        for neighbour, length, speed, depth, advisory_flagged in graph.get(node, []):
            if depth >= clearance:
                continue
            penalty = 1.0 + math.pow(depth / 10.0, 1.8)
            effective_speed = max((speed / 3.6) / penalty, 0.5)
            hop_time = length / effective_speed
            if advisory_flagged:
                hop_time *= ADVISORY_PENALTY
            candidate = cost + hop_time
            if candidate < distances.get(neighbour, math.inf):
                distances[neighbour] = candidate
                heapq.heappush(pq, (candidate, neighbour))

    return math.inf


def path_cost(graph, path, clearance=CLEARANCE):
    """Recompute travel time along a returned path, from the graph itself."""
    total = 0.0
    for u, v in zip(path, path[1:], strict=False):
        hop = next(
            (entry for entry in graph.get(u, []) if entry[0] == v),
            None,
        )
        assert hop is not None, f"path uses non-existent edge {u}->{v}"
        _, length, speed, depth, advisory_flagged = hop
        assert depth < clearance, f"path uses impassable edge {u}->{v}"
        penalty = 1.0 + math.pow(depth / 10.0, 1.8)
        hop_time = length / max((speed / 3.6) / penalty, 0.5)
        total += hop_time * ADVISORY_PENALTY if advisory_flagged else hop_time
    return total


# ---------------------------------------------------------------------------
# Optimality
# ---------------------------------------------------------------------------


def test_a_star_matches_dijkstra_under_flooding():
    rng = random.Random(20261021)
    checked = 0

    for _ in range(2000):
        depths = [round(rng.uniform(0, 29.9), 2) for _ in EDGES]
        graph = build_graph(depths)

        for start, target in itertools.permutations(NODES, 2):
            path, cost = td_a_star_search(NODES, graph, start, target, CLEARANCE)
            optimum = dijkstra(graph, start, target)
            checked += 1

            if optimum == math.inf:
                assert path == [], f"expected no route {start}->{target} at depths {depths}"
                continue

            assert path, f"expected a route {start}->{target} at depths {depths}"
            assert cost == pytest.approx(optimum, rel=1e-9), (
                f"suboptimal route {start}->{target} at depths {depths}: "
                f"got {cost}, optimum {optimum}"
            )
            assert path_cost(graph, path) == pytest.approx(cost, rel=1e-9)

    assert checked == 2000 * 12


def test_heuristic_is_admissible_when_graph_is_faster_than_50_kmh():
    """
    Edge 1 allows 60 km/h. With a 50 km/h heuristic divisor the old code was
    inadmissible; a dry run must still select the genuinely fastest corridor.
    """
    graph = build_graph([0.0, 0.0, 0.0, 0.0])
    path, cost = td_a_star_search(NODES, graph, 1, 4, CLEARANCE)
    assert path == [1, 2, 3, 4]
    assert cost == pytest.approx(dijkstra(graph, 1, 4), rel=1e-9)


def test_undirected_routing_supports_reverse_trip():
    """The seed is one-directional; the API graph is bidirectional."""
    graph = build_graph([0.0, 0.0, 0.0, 0.0])
    path, cost = td_a_star_search(NODES, graph, 4, 1, CLEARANCE)
    assert path == [4, 3, 2, 1]
    assert cost == pytest.approx(dijkstra(graph, 4, 1), rel=1e-9)


# ---------------------------------------------------------------------------
# Clearance + passability
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "depths,clearance,expected_path",
    [
        ([0.0, 0.0, 0.0, 0.0], 20.0, [1, 2, 3, 4]),
        # 120 mm/hr: every edge is above 20 cm, so a sedan is stranded.
        ([33.92, 51.77, 54.68, 33.92], 20.0, []),
        # A 35 cm vehicle can use the direct high-elevation edge only.
        ([33.92, 51.77, 54.68, 33.92], 35.0, [1, 4]),
        # A 60 cm vehicle can physically clear everything, but the exponential
        # water penalty still makes the direct edge the faster choice.
        ([33.92, 51.77, 54.68, 33.92], 60.0, [1, 4]),
    ],
)
def test_clearance_gates_route_availability(depths, clearance, expected_path):
    graph = build_graph(depths)
    path, _ = td_a_star_search(NODES, graph, 1, 4, clearance)
    assert path == expected_path


def test_submerged_edge_is_never_traversed():
    # Only the short 1-2-3-4 corridor is flooded; the direct 1-4 edge is dry.
    graph = build_graph([40.0, 40.0, 40.0, 0.0])
    path, _ = td_a_star_search(NODES, graph, 1, 4, CLEARANCE)
    assert path == [1, 4]


def test_advisory_penalty_prefers_the_unflagged_detour_but_never_blocks():
    """BRULE-012: a flagged sensor advisory never closes a road, only discourages it."""
    nodes = {1: (14.6000, 121.0000), 2: (14.6000, 121.0090), 3: (14.6010, 121.0045)}

    def haversine(a, b):
        R = 6371000.0
        lat1, lon1 = math.radians(a[0]), math.radians(a[1])
        lat2, lon2 = math.radians(b[0]), math.radians(b[1])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))

    d12 = haversine(nodes[1], nodes[2])
    d13 = haversine(nodes[1], nodes[3])
    d32 = haversine(nodes[3], nodes[2])

    # The direct 1-2 edge is shorter, but flagged; the detour via 3 is longer but clean.
    flagged = {
        1: [(2, d12, 40.0, 0.0, True), (3, d13, 40.0, 0.0, False)],
        2: [(1, d12, 40.0, 0.0, True)],
        3: [(1, d13, 40.0, 0.0, False), (2, d32, 40.0, 0.0, False)],
    }
    path, _ = td_a_star_search(nodes, flagged, 1, 2, CLEARANCE)
    assert path == [1, 3, 2], "a flagged edge should be routed around when a clean detour exists"

    unflagged = {k: [(v[0], v[1], v[2], v[3], False) for v in vs] for k, vs in flagged.items()}
    path, _ = td_a_star_search(nodes, unflagged, 1, 2, CLEARANCE)
    assert path == [1, 2], "with nothing flagged, the shorter direct edge should win"

    only_flagged = {1: [(2, d12, 40.0, 0.0, True)], 2: [(1, d12, 40.0, 0.0, True)]}
    path, seconds = td_a_star_search(nodes, only_flagged, 1, 2, CLEARANCE)
    assert path == [1, 2] and seconds < math.inf, (
        "a flagged edge with no alternative must still route"
    )


def test_unreachable_returns_empty_path():
    graph = build_graph([40.0, 40.0, 40.0, 40.0])
    assert td_a_star_search(NODES, graph, 1, 4, CLEARANCE) == ([], math.inf)


def test_unknown_node_does_not_raise():
    graph = build_graph([0.0, 0.0, 0.0, 0.0])
    assert td_a_star_search(NODES, graph, 99, 4, CLEARANCE) == ([], math.inf)
    assert td_a_star_search(NODES, graph, 1, 99, CLEARANCE) == ([], math.inf)


def test_same_origin_and_destination():
    graph = build_graph([0.0, 0.0, 0.0, 0.0])
    assert td_a_star_search(NODES, graph, 2, 2, CLEARANCE) == ([2], 0.0)


# ---------------------------------------------------------------------------
# Classification boundaries
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "depth,clearance,expected",
    [
        (0.0, 30.0, PASSABLE),
        (9.99, 30.0, PASSABLE),
        (10.0, 30.0, LIGHT_FLOOD),  # inclusive caution boundary
        (29.99, 30.0, LIGHT_FLOOD),
        (30.0, 30.0, SUBMERGED),  # inclusive impassable boundary
        (80.0, 30.0, SUBMERGED),
        (35.0, 60.0, LIGHT_FLOOD),  # passable for a taller vehicle
    ],
)
def test_classify_passability_boundaries(depth, clearance, expected):
    assert classify_passability(depth, clearance) == expected


def test_same_edge_is_passable_for_truck_and_submerged_for_sedan():
    assert classify_passability(45.0, 20.0) == SUBMERGED
    assert classify_passability(45.0, 60.0) == LIGHT_FLOOD


# ---------------------------------------------------------------------------
# Hazard blocking (TSD 2.6)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "level,blocking",
    [
        ("CAUTION", False),
        ("caution", False),
        ("LEVEL_2", True),  # knee-deep: an approved KNEE report
        ("LEVEL_3", True),
        ("IMPASSABLE", True),
        ("impassable", True),
        (None, False),
        ("", False),
    ],
)
def test_hazard_blocking_levels(level, blocking):
    # The router and the route-hazard report share this definition, so CAUTION
    # must stay drivable and everything above it must not.
    assert hazard_blocks(level) is blocking


# ---------------------------------------------------------------------------
# Turn-by-turn instructions (FSD-FR-057)
# ---------------------------------------------------------------------------


def test_bearing_is_clockwise_from_north():
    north = bearing_degrees((14.5, 121.0), (14.6, 121.0))
    east = bearing_degrees((14.5, 121.0), (14.5, 121.1))
    south = bearing_degrees((14.6, 121.0), (14.5, 121.0))

    assert north == pytest.approx(0.0, abs=0.5)
    assert east == pytest.approx(90.0, abs=0.5)
    assert south == pytest.approx(180.0, abs=0.5)


def test_compass_points_wrap():
    assert compass_point(0.0) == "north"
    assert compass_point(359.0) == "north"
    assert compass_point(90.0) == "east"
    assert compass_point(225.0) == "south-west"


@pytest.mark.parametrize(
    "previous,next_,manoeuvre",
    [
        (0.0, 0.0, STRAIGHT),
        (0.0, 15.0, STRAIGHT),  # a bend, not a turn
        (0.0, 30.0, SLIGHT_RIGHT),
        (0.0, 330.0, SLIGHT_LEFT),
        (0.0, 90.0, TURN_RIGHT),
        (90.0, 0.0, TURN_LEFT),
        (0.0, 180.0, U_TURN),
        (350.0, 10.0, STRAIGHT),  # cross the north seam without a false turn
    ],
)
def test_classify_turn(previous, next_, manoeuvre):
    assert classify_turn(previous, next_) == manoeuvre


def _instructions(path, hops, coordinates, names=None):
    return build_instructions(path, hops, coordinates, names or {})


def test_instructions_start_with_depart_and_end_with_arrive():
    # Straight north along a named road, then east onto another.
    coordinates = {1: (14.50, 121.00), 2: (14.51, 121.00), 3: (14.51, 121.01)}
    hops = [(1, 2, 1100.0, "C5"), (2, 3, 1000.0, "Kalayaan Ave")]

    steps = _instructions([1, 2, 3], hops, coordinates)

    assert [step.manoeuvre for step in steps] == [DEPART, TURN_RIGHT, ARRIVE]
    assert steps[0].text == "Head north on C5"
    assert steps[1].text == "Turn right onto Kalayaan Ave"
    assert steps[2].text == "Arrive at your destination"
    assert steps[0].distance_m == pytest.approx(1100.0)
    assert steps[2].distance_m == 0.0


def test_straight_hops_merge_into_one_step():
    # Two hops on the same heading are one instruction with the summed length.
    coordinates = {1: (14.50, 121.00), 2: (14.51, 121.00), 3: (14.52, 121.00)}
    hops = [(1, 2, 500.0, "C5"), (2, 3, 700.0, "C5")]

    steps = _instructions([1, 2, 3], hops, coordinates, {3: "Bagong Ilog"})

    assert [step.manoeuvre for step in steps] == [DEPART, ARRIVE]
    assert steps[0].distance_m == pytest.approx(1200.0)
    assert steps[0].end_node_id == 3
    assert steps[1].text == "Arrive at Bagong Ilog"


def test_uturn_hop_gets_its_own_step():
    coordinates = {1: (14.50, 121.00), 2: (14.51, 121.00), 3: (14.50, 121.00)}
    hops = [(1, 2, 400.0, "C5"), (2, 3, 400.0, "C5")]

    steps = _instructions([1, 2, 3], hops, coordinates)

    assert [step.manoeuvre for step in steps] == [DEPART, U_TURN, ARRIVE]
    assert steps[1].text == "Make a U-turn onto C5"


def test_missing_destination_coordinate_still_produces_a_drivable_route():
    hops = [(1, 2, 400.0, "C5")]

    steps = _instructions([1, 2], hops, {})

    assert [step.manoeuvre for step in steps] == [DEPART, ARRIVE]


def test_zero_length_path_is_an_arrival():
    steps = _instructions([7], [], {7: (14.5, 121.0)}, {7: "Shaw"})

    assert len(steps) == 1
    assert steps[0].manoeuvre == ARRIVE
    assert steps[0].text == "Arrive at Shaw"
