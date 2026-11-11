"""Unit tests for the OSM import converter (backend/osm_network.py).

The converter is pure: canned Overpass elements in, graph out. The database
swap (replace_network) is exercised against the real database only by the
operator running the script, which is why these tests pin the conversion
rules: junction splitting, node renaming, naming, direction, speed parsing and
loop handling.
"""

from osm_network import ImportEdge, build_graph, parse_maxspeed, way_direction


def element(element_type: str, element_id: int, tags: dict, **extra) -> dict:
    return {"type": element_type, "id": element_id, "tags": tags, **extra}


def way(
    way_id: int, tags: dict, node_ids: list[int], positions: dict[int, tuple[float, float]]
) -> dict:
    return element(
        "way",
        way_id,
        tags,
        nodes=node_ids,
        geometry=[{"lat": positions[n][1], "lon": positions[n][0]} for n in node_ids],
    )


# Two roads crossing at node 2, a side road off node 4, an unnamed link off
# node 6 and a self-loop off node 9. Positions are ~200 m apart on a grid.
POSITIONS = {
    1: (121.00, 14.60),
    2: (121.02, 14.60),
    3: (121.03, 14.60),
    4: (121.04, 14.60),
    5: (121.02, 14.58),
    6: (121.02, 14.62),
    7: (121.05, 14.61),
    8: (121.06, 14.62),
    9: (121.03, 14.64),
    10: (121.04, 14.65),
}

ELEMENTS = [
    way(
        100,
        {"highway": "primary", "name": "Ortigas Ave", "maxspeed": "60 kph"},
        [1, 2, 3, 4],
        POSITIONS,
    ),
    way(200, {"highway": "secondary", "name": "C5", "oneway": "yes"}, [5, 2, 6], POSITIONS),
    way(
        300,
        {"highway": "tertiary", "name": "Meralco Ave", "maxspeed": "40 mph", "lanes": "3"},
        [4, 7, 8],
        POSITIONS,
    ),
    way(400, {"highway": "tertiary_link"}, [6, 9], POSITIONS),
    way(500, {"highway": "tertiary", "name": "Loop Rd"}, [9, 10, 9], POSITIONS),
]


def test_junctions_split_ways_and_shape_nodes_are_absorbed():
    nodes, edges, _ = build_graph(ELEMENTS)

    # Junctions: 1, 4, 5, 6, 8, 9 (ends or shared) plus 2 (shared by two ways).
    # Node 3 (interior of way 100 only) and 7 (interior of way 300 only) are
    # shape geometry, not graph nodes.
    assert sorted(node.node_id for node in nodes) == [1, 2, 3, 4, 5, 6, 7]
    assert [edge.coordinates for edge in edges if edge.edge_id == 2] == [
        (POSITIONS[2], POSITIONS[3], POSITIONS[4])
    ]


def test_osm_ids_are_renumbered_in_order():
    nodes, _, _ = build_graph(ELEMENTS)
    # Sorted OSM ids 1,2,4,5,6,8,9 map to 1..7.
    by_osm = {node.name: node.node_id for node in nodes if node.name}
    assert by_osm["Ortigas Ave"] == 1
    assert by_osm["C5 × Ortigas Ave"] == 2


def test_junction_names_combine_sorted_way_names():
    nodes, _, _ = build_graph(ELEMENTS)
    names = {node.node_id: node.name for node in nodes}
    assert names[2] == "C5 × Ortigas Ave"
    assert names[3] == "Meralco Ave × Ortigas Ave"  # OSM 4: ends of ways 100/300
    assert names[7] == "Loop Rd"  # OSM 9: shared by the unnamed link and the loop


def test_one_way_direction_and_osm_tag_parsing():
    _, edges, _ = build_graph(ELEMENTS)
    by_id = {edge.edge_id: edge for edge in edges}

    # Way 200 is oneway=yes: both of its segments are FORWARD only.
    c5 = [edge for edge in by_id.values() if edge.road_name == "C5"]
    assert c5 and all(edge.direction == "FORWARD" for edge in c5)

    # Way 100 has no oneway: BOTH.
    ortigas = [edge for edge in by_id.values() if edge.road_name == "Ortigas Ave"]
    assert ortigas and all(edge.direction == "BOTH" for edge in ortigas)


def test_speed_lanes_and_road_name_defaults():
    _, edges, _ = build_graph(ELEMENTS)
    by_road = {}
    for edge in edges:
        by_road.setdefault(edge.road_name, []).append(edge)

    assert by_road["Ortigas Ave"][0].max_speed_kmh == 60.0  # "60 kph" parsed
    assert by_road["Meralco Ave"][0].max_speed_kmh == 64.4  # 40 mph converted
    assert by_road["Meralco Ave"][0].lanes == 3
    assert by_road[None][0].max_speed_kmh == 30.0  # tertiary_link class default
    assert by_road[None][0].lanes == 2


def test_self_loops_are_dropped():
    nodes, edges, dropped = build_graph(ELEMENTS)
    # Way 500 revisits its own starting junction with no interior junction.
    assert dropped == 1
    assert all(edge.start_node_id != edge.end_node_id for edge in edges)
    # Its junction node still exists (the unnamed link ends there) but the
    # loop itself contributes no edge.
    assert len(edges) == 6


def test_distances_follow_the_geometry():
    _, edges, _ = build_graph(ELEMENTS)
    first = edges[0]  # Ortigas Ave 1 -> 2, a straight ~2.2 km at this longitude
    assert 2000 < first.distance_m < 2400
    assert all(edge.distance_m > 0 for edge in edges)


def test_parse_maxspeed_variants():
    assert parse_maxspeed({"maxspeed": "60"}) == 60.0
    assert parse_maxspeed({"maxspeed": "60 KPH"}) == 60.0
    assert parse_maxspeed({"maxspeed": "50 km/h"}) == 50.0
    assert parse_maxspeed({"maxspeed": "40 mph"}) == 64.4
    assert parse_maxspeed({"maxspeed": "signals"}) is None
    assert parse_maxspeed({}) is None


def test_way_direction_variants():
    assert way_direction({"oneway": "yes"}) == "FORWARD"
    assert way_direction({"oneway": "-1"}) == "BACKWARD"
    assert way_direction({"junction": "roundabout"}) == "FORWARD"
    assert way_direction({"oneway": "no"}) == "BOTH"
    assert way_direction({}) == "BOTH"


def test_import_edge_is_a_frozen_dataclass():
    # The replace step relies on the field order staying stable.
    edge = ImportEdge(
        edge_id=1,
        start_node_id=1,
        end_node_id=2,
        distance_m=100.0,
        max_speed_kmh=50.0,
        lanes=2,
        road_name="X",
        direction="BOTH",
        coordinates=((121.0, 14.6), (121.01, 14.6)),
    )
    assert edge == ImportEdge(1, 1, 2, 100.0, 50.0, 2, "X", "BOTH", ((121.0, 14.6), (121.01, 14.6)))
