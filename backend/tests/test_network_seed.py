"""Contract tests for the seeded road network (TSD LIM-014).

The seed is data, so these tests are the only thing standing between a typo and
a database full of impossible geometry. They cover three separate risks:

* the original four-node spine must not move (tests, docs and screenshots);
* the graph must be internally consistent and fully connected (routing);
* applying it must be idempotent and additive (it runs against production).
"""

from __future__ import annotations

import models
import network_seed


class _StateFilter:
    def __init__(self, states: dict[int, models.LiveEdgeState], edge_id: int) -> None:
        self._states = states
        self._edge_id = edge_id

    def one_or_none(self):
        return self._states.get(self._edge_id)


class _StateQuery:
    def __init__(self, states: dict[int, models.LiveEdgeState]) -> None:
        self._states = states

    def filter_by(self, **kwargs):
        return _StateFilter(self._states, kwargs["edge_id"])


class FakeSession:
    """Just enough of a Session for ``network_seed.apply``.

    The persistence test exists to prove the upsert is additive and idempotent;
    it does not need a live database to do that.
    """

    def __init__(self) -> None:
        self.nodes: dict[int, models.RoadNode] = {}
        self.edges: dict[int, models.RoadEdge] = {}
        self.states: dict[int, models.LiveEdgeState] = {}
        self.committed = False
        self.rolled_back = False

    def get(self, model, primary_key):
        if model is models.RoadNode:
            return self.nodes.get(primary_key)
        if model is models.RoadEdge:
            return self.edges.get(primary_key)
        raise AssertionError(f"unexpected get for {model}")

    def add(self, obj) -> None:
        if isinstance(obj, models.RoadNode):
            self.nodes[obj.node_id] = obj
        elif isinstance(obj, models.RoadEdge):
            self.edges[obj.edge_id] = obj
        elif isinstance(obj, models.LiveEdgeState):
            self.states[obj.edge_id] = obj
        else:  # pragma: no cover - guards against a seed that writes something new
            raise AssertionError(f"unexpected add for {type(obj)}")

    def query(self, model):
        if model is models.LiveEdgeState:
            return _StateQuery(self.states)
        raise AssertionError(f"unexpected query for {model}")

    def flush(self) -> None:
        pass

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


# ---------------------------------------------------------------------------
# The data itself
# ---------------------------------------------------------------------------


def test_original_spine_is_unchanged() -> None:
    """Nodes and edges 1-4 are the contract with the existing tests and docs."""
    nodes, edges = network_seed.build_network()
    by_id = {node.node_id: node for node in nodes}
    edges_by_id = {edge.edge_id: edge for edge in edges}

    expected_nodes = {
        1: ("C5 - Market Market", 14.5491, 121.0553, 8.5),
        2: ("C5 - Kalayaan Ave", 14.5583, 121.0581, 4.2),
        3: ("C5 - Bagong Ilog", 14.5672, 121.0631, 3.5),
        4: ("Pasig Blvd - Shaw", 14.5731, 121.0685, 9.0),
    }
    for node_id, (name, latitude, longitude, elevation) in expected_nodes.items():
        node = by_id[node_id]
        assert (node.name, node.latitude, node.longitude, node.elevation_m) == (
            name,
            latitude,
            longitude,
            elevation,
        )

    expected_edges = {
        1: (1, 2, 1100.0, 60.0),
        2: (2, 3, 1000.0, 50.0),
        3: (3, 4, 850.0, 50.0),
        4: (1, 4, 2800.0, 40.0),
    }
    for edge_id, (start, end, distance, speed) in expected_edges.items():
        edge = edges_by_id[edge_id]
        assert (edge.start_node_id, edge.end_node_id, edge.distance_m, edge.max_speed_kmh) == (
            start,
            end,
            distance,
            speed,
        )


def test_seed_graph_is_consistent() -> None:
    nodes, edges = network_seed.build_network()
    network_seed.validate(nodes, edges)  # raises on any inconsistency

    known = {node.node_id for node in nodes}
    assert all(edge.start_node_id in known and edge.end_node_id in known for edge in edges)
    assert all(edge.distance_m > 0 for edge in edges)


def test_network_is_much_larger_than_the_old_seed() -> None:
    """The old graph had 4 nodes and 4 edges; LIM-014 asks for a usable network."""
    nodes, edges = network_seed.build_network()
    assert len(nodes) >= 30
    assert len(edges) >= 50


def test_every_node_is_reachable_without_flooding() -> None:
    """A disconnected node would make routing return 404 for a valid request."""
    nodes, edges = network_seed.build_network()
    adjacency: dict[int, set[int]] = {node.node_id: set() for node in nodes}
    for edge in edges:
        adjacency[edge.start_node_id].add(edge.end_node_id)
        adjacency[edge.end_node_id].add(edge.start_node_id)

    seen = {1}
    stack = [1]
    while stack:
        current = stack.pop()
        for neighbour in adjacency[current]:
            if neighbour not in seen:
                seen.add(neighbour)
                stack.append(neighbour)

    assert seen == set(adjacency)


def test_low_lying_spine_nodes_sit_below_the_ridge() -> None:
    """The elevation model must keep the documented flood-hotspots lowest."""
    nodes, _ = network_seed.build_network()
    elevations = {node.node_id: node.elevation_m for node in nodes}

    assert elevations[3] < elevations[2] < elevations[1] < elevations[4]
    assert all(3.0 <= value <= 12.0 for value in elevations.values())


def test_node_ids_do_not_collide_with_the_lattice() -> None:
    nodes, _ = network_seed.build_network()
    lattice_ids = [node.node_id for node in nodes if node.node_id >= network_seed.LATTICE_NODE_BASE]
    assert lattice_ids, "expected lattice nodes"
    assert not set(lattice_ids) & {1, 2, 3, 4}


# ---------------------------------------------------------------------------
# Persistence behaviour
# ---------------------------------------------------------------------------


def test_apply_creates_the_network_once() -> None:
    db = FakeSession()
    first = network_seed.apply(db)

    nodes, edges = network_seed.build_network()
    assert first["nodes_created"] == len(nodes)
    assert first["edges_created"] == len(edges)
    assert first["states_created"] == len(edges)
    assert first["nodes_updated"] == 0
    assert db.committed is True


def test_apply_is_idempotent() -> None:
    db = FakeSession()
    network_seed.apply(db)
    second = network_seed.apply(db)

    assert second == {
        "nodes_created": 0,
        "nodes_updated": 0,
        "edges_created": 0,
        "edges_updated": 0,
        "states_created": 0,
    }


def test_apply_repairs_drifted_coordinates() -> None:
    db = FakeSession()
    network_seed.apply(db)
    db.nodes[1].latitude = 0.0

    counts = network_seed.apply(db)

    assert counts["nodes_updated"] == 1
    assert db.nodes[1].latitude == 14.5491


def test_apply_preserves_live_flood_state() -> None:
    """A re-run must never clear the operator's current water depths."""
    db = FakeSession()
    network_seed.apply(db)
    db.states[3].water_depth_cm = 42.0
    db.states[3].is_override = True

    counts = network_seed.apply(db)

    assert counts["states_created"] == 0
    assert db.states[3].water_depth_cm == 42.0
    assert db.states[3].is_override is True


def test_apply_never_deletes_rows_outside_the_seed() -> None:
    """Real imported roads, hazards and dispatches reference this table."""
    db = FakeSession()
    db.nodes[9_999] = models.RoadNode(
        node_id=9_999, name="Imported node", latitude=14.5, longitude=121.0, elevation_m=7.0
    )

    network_seed.apply(db)

    assert 9_999 in db.nodes


def test_dry_run_rolls_back() -> None:
    db = FakeSession()
    counts = network_seed.apply(db, dry_run=True)

    assert counts["nodes_created"] > 0
    assert db.rolled_back is True
    assert db.committed is False
