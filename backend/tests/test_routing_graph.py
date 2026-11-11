"""One-way handling in the routing adjacency (backend/main.py::_routing_graph).

The A* itself is direction-agnostic; the rule that matters is which directed
traversals the adjacency builder emits for each edge, so these tests pin the
builder directly on in-memory model instances, no database needed.
"""

import models
from main import _routing_graph


def node(node_id: int, latitude: float, longitude: float) -> models.RoadNode:
    return models.RoadNode(
        node_id=node_id, name=None, latitude=latitude, longitude=longitude, elevation_m=10.0
    )


def edge(
    edge_id: int,
    start: int,
    end: int,
    direction: str,
    distance_m: float = 100.0,
    speed: float = 50.0,
) -> models.RoadEdge:
    return models.RoadEdge(
        edge_id=edge_id,
        start_node_id=start,
        end_node_id=end,
        distance_meters=distance_m,
        max_speed_kmh=speed,
        lanes=2,
        road_name=None,
        direction=direction,
    )


NODES = {
    n.node_id: n for n in (node(1, 14.55, 121.05), node(2, 14.56, 121.05), node(3, 14.57, 121.05))
}


def graph(edges):
    return _routing_graph(NODES, edges, {}, set(), set())


def destinations_of(adjacency, origin: int) -> list[int]:
    return [hop[0] for hop in adjacency.get(origin, [])]


def test_forward_edge_only_allows_start_to_end():
    _, adjacency, pairs = graph([edge(10, 1, 2, "FORWARD")])
    assert destinations_of(adjacency, 1) == [2]
    assert 2 not in adjacency
    assert (1, 2) in pairs and (2, 1) not in pairs


def test_backward_edge_only_allows_end_to_start():
    _, adjacency, pairs = graph([edge(10, 1, 2, "BACKWARD")])
    assert destinations_of(adjacency, 2) == [1]
    assert 1 not in adjacency
    assert (2, 1) in pairs and (1, 2) not in pairs


def test_both_edge_allows_either_direction():
    _, adjacency, pairs = graph([edge(10, 1, 2, "BOTH")])
    assert destinations_of(adjacency, 1) == [2]
    assert destinations_of(adjacency, 2) == [1]
    assert (1, 2) in pairs and (2, 1) in pairs


def test_opposite_carriageways_coexist():
    # Two divided carriageways connect the same junctions in opposite orders;
    # the ordered pair index must keep both, and routing stays legal.
    _, adjacency, pairs = graph(
        [edge(10, 1, 2, "FORWARD"), edge(11, 2, 1, "FORWARD"), edge(12, 2, 3, "BOTH")]
    )
    assert destinations_of(adjacency, 1) == [2]
    assert sorted(destinations_of(adjacency, 2)) == [1, 3]
    assert pairs[(1, 2)].edge_id == 10 and pairs[(2, 1)].edge_id == 11


def test_blocked_edges_never_join_the_graph():
    nodes, edges, states = NODES, [edge(10, 1, 2, "BOTH")], {}
    _, adjacency, _ = _routing_graph(nodes, edges, states, {10}, set())
    assert adjacency == {}
