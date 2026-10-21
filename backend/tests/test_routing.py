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
    LIGHT_FLOOD,
    PASSABLE,
    SUBMERGED,
    classify_passability,
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
    for (u, v, length, speed), depth in zip(EDGES, depths):
        graph.setdefault(u, []).append((v, length, speed, depth))
        if bidirectional:
            graph.setdefault(v, []).append((u, length, speed, depth))
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

        for neighbour, length, speed, depth in graph.get(node, []):
            if depth >= clearance:
                continue
            penalty = 1.0 + math.pow(depth / 10.0, 1.8)
            effective_speed = max((speed / 3.6) / penalty, 0.5)
            candidate = cost + length / effective_speed
            if candidate < distances.get(neighbour, math.inf):
                distances[neighbour] = candidate
                heapq.heappush(pq, (candidate, neighbour))

    return math.inf


def path_cost(graph, path, clearance=CLEARANCE):
    """Recompute travel time along a returned path, from the graph itself."""
    total = 0.0
    for u, v in zip(path, path[1:]):
        hop = next(
            (entry for entry in graph.get(u, []) if entry[0] == v),
            None,
        )
        assert hop is not None, f"path uses non-existent edge {u}->{v}"
        _, length, speed, depth = hop
        assert depth < clearance, f"path uses impassable edge {u}->{v}"
        penalty = 1.0 + math.pow(depth / 10.0, 1.8)
        total += length / max((speed / 3.6) / penalty, 0.5)
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
        (10.0, 30.0, LIGHT_FLOOD),   # inclusive caution boundary
        (29.99, 30.0, LIGHT_FLOOD),
        (30.0, 30.0, SUBMERGED),     # inclusive impassable boundary
        (80.0, 30.0, SUBMERGED),
        (35.0, 60.0, LIGHT_FLOOD),   # passable for a taller vehicle
    ],
)
def test_classify_passability_boundaries(depth, clearance, expected):
    assert classify_passability(depth, clearance) == expected


def test_same_edge_is_passable_for_truck_and_submerged_for_sedan():
    assert classify_passability(45.0, 20.0) == SUBMERGED
    assert classify_passability(45.0, 60.0) == LIGHT_FLOOD
