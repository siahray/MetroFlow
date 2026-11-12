import heapq
import math
from dataclasses import dataclass

from config import settings

# ---------------------------------------------------------------------------
# Passability classification
# ---------------------------------------------------------------------------
# These three labels are the contract between the routing engine and the map
# renderer. They MUST be produced by a single function so the legend colour and
# the A* blocking rule can never disagree.

PASSABLE = "PASSABLE"
LIGHT_FLOOD = "LIGHT_FLOOD"
SUBMERGED = "SUBMERGED"

# ---------------------------------------------------------------------------
# Routing mode
# ---------------------------------------------------------------------------
# The router has two personalities. With no flood anywhere in the graph there is
# nothing to avoid, so it plans the plain fastest path a general-purpose map
# would give: no water or advisory cost terms, a wet-but-drivable road is just a
# road. Any flood at all -- water at or above the caution depth, a live sensor
# advisory, or a published closure -- switches it to the time-dependent cost.
# Both share one search; only the cost of a hop differs.

FASTEST = "FASTEST"
FLOOD_SAFE = "FLOOD_SAFE"


def routing_mode(
    graph_edges: dict[int, list[tuple[int, float, float, float, bool]]],
    *,
    road_closure: bool = False,
    caution_depth_cm: float | None = None,
) -> str:
    """``FASTEST`` when nothing in the graph is flooded or advised, else ``FLOOD_SAFE``.

    ``graph_edges`` is the adjacency the search will run on, so this asks exactly
    the graph the router will see. ``road_closure`` carries the fact that a
    blocking hazard removed edges, which the adjacency no longer shows.
    """
    if road_closure:
        return FLOOD_SAFE
    caution = settings.caution_depth_cm if caution_depth_cm is None else caution_depth_cm
    for adjacency in graph_edges.values():
        for _, _, _, water_depth_cm, advisory_flagged in adjacency:
            if advisory_flagged or water_depth_cm >= caution:
                return FLOOD_SAFE
    return FASTEST


def classify_passability(
    water_depth_cm: float,
    clearance_cm: float,
    caution_depth_cm: float | None = None,
) -> str:
    """
    Classify a road edge for a given vehicle clearance.

    ``water >= clearance`` is impassable, so the submerge check is inclusive.
    ``water >= caution`` is a flood warning but still drivable.
    """
    caution = settings.caution_depth_cm if caution_depth_cm is None else caution_depth_cm

    if water_depth_cm >= clearance_cm:
        return SUBMERGED
    if water_depth_cm >= caution:
        return LIGHT_FLOOD
    return PASSABLE


# --- Hazard blocking -------------------------------------------------------
# FSD §BRULE-008: only a verified hazard affects routing. The TSD (§2.6) names
# LEVEL_3 and IMPASSABLE as excluding an edge and CAUTION as passable-but-alerted,
# leaving LEVEL_2 between the two. A knee-deep crossing (the level an approved
# KNEE report raises) is not a lane a rescue vehicle should be routed through,
# so every level above CAUTION blocks. Keeping this in one function means the
# router and the route-hazard report cannot disagree about what "blocks" means.

BLOCKING_OBSTRUCTION_LEVELS = frozenset({"LEVEL_2", "LEVEL_3", "IMPASSABLE"})


def hazard_blocks(obstruction_level: str | None) -> bool:
    """Whether a verified hazard of this level closes the roads it covers."""
    return (obstruction_level or "").upper() in BLOCKING_OBSTRUCTION_LEVELS


# --- Turn-by-turn instructions (FSD-FR-057) --------------------------------

# A heading change under this many degrees is the same road bending, not a turn.
STRAIGHT_THRESHOLD_DEG = 20.0
# Between straight and a full turn: "bear left/right" rather than "turn".
SLIGHT_TURN_THRESHOLD_DEG = 45.0
# Beyond this it is a reversal, not a turn onto a cross street.
U_TURN_THRESHOLD_DEG = 135.0

DEPART = "DEPART"
ARRIVE = "ARRIVE"
STRAIGHT = "STRAIGHT"
TURN_LEFT = "TURN_LEFT"
TURN_RIGHT = "TURN_RIGHT"
SLIGHT_LEFT = "SLIGHT_LEFT"
SLIGHT_RIGHT = "SLIGHT_RIGHT"
U_TURN = "U_TURN"

_COMPASS = (
    "north",
    "north-east",
    "east",
    "south-east",
    "south",
    "south-west",
    "west",
    "north-west",
)


@dataclass(frozen=True)
class RouteStep:
    """One spoken instruction and the distance the driver travels on it."""

    manoeuvre: str
    road_name: str | None
    distance_m: float
    start_node_id: int
    end_node_id: int
    text: str


def bearing_degrees(start: tuple[float, float], end: tuple[float, float]) -> float:
    """Initial great-circle bearing from ``start`` to ``end``, clockwise from north."""
    lat1, lon1 = math.radians(start[0]), math.radians(start[1])
    lat2, lon2 = math.radians(end[0]), math.radians(end[1])
    delta_lon = lon2 - lon1
    x = math.sin(delta_lon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lon)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def compass_point(bearing: float) -> str:
    """The eight-point compass name for a bearing."""
    return _COMPASS[int((bearing % 360.0) / 45.0 + 0.5) % 8]


def classify_turn(previous_bearing: float, next_bearing: float) -> str:
    """Turn manoeuvre for a heading change, signed clockwise (positive = right)."""
    delta = (next_bearing - previous_bearing + 540.0) % 360.0 - 180.0
    magnitude = abs(delta)
    if magnitude <= STRAIGHT_THRESHOLD_DEG:
        return STRAIGHT
    if magnitude >= U_TURN_THRESHOLD_DEG:
        return U_TURN
    right = delta > 0
    if magnitude <= SLIGHT_TURN_THRESHOLD_DEG:
        return SLIGHT_RIGHT if right else SLIGHT_LEFT
    return TURN_RIGHT if right else TURN_LEFT


def _instruction_text(
    manoeuvre: str,
    road_name: str | None,
    start_bearing: float,
    destination_name: str | None,
) -> str:
    road = road_name or "the road"
    if manoeuvre == DEPART:
        return f"Head {compass_point(start_bearing)} on {road}"
    if manoeuvre == TURN_LEFT:
        return f"Turn left onto {road}"
    if manoeuvre == TURN_RIGHT:
        return f"Turn right onto {road}"
    if manoeuvre == SLIGHT_LEFT:
        return f"Bear left onto {road}"
    if manoeuvre == SLIGHT_RIGHT:
        return f"Bear right onto {road}"
    if manoeuvre == U_TURN:
        return f"Make a U-turn onto {road}"
    return f"Arrive at {destination_name or 'your destination'}"


def build_instructions(
    path: list[int],
    hops: list[tuple[int, int, float, str | None]],
    node_coordinates: dict[int, tuple[float, float]],
    node_names: dict[int, str | None],
) -> list[RouteStep]:
    """Turn-by-turn steps for a path (FSD-FR-057).

    ``hops`` is one entry per traversed edge in travel order:
    ``(start_node, end_node, distance_m, road_name)``. A heading change below
    ``STRAIGHT_THRESHOLD_DEG`` does not start a new step, so a bendy arterial
    does not produce a turn every block; steps therefore carry the distance
    that remains on them, which is what the banner counts down.
    """
    if not path:
        return []

    if not hops:
        name = node_names.get(path[0])
        return [
            RouteStep(
                manoeuvre=ARRIVE,
                road_name=None,
                distance_m=0.0,
                start_node_id=path[0],
                end_node_id=path[0],
                text=_instruction_text(ARRIVE, None, 0.0, name),
            )
        ]

    bearings = [
        bearing_degrees(node_coordinates[start], node_coordinates[end])
        for start, end, _, _ in hops
        if start in node_coordinates and end in node_coordinates
    ]
    # A path with a missing coordinate cannot be judged turn by turn, but it can
    # still be driven; fall back to a single departure plus arrival.
    if len(bearings) != len(hops):
        bearings = [0.0] * len(hops)

    # (path index where the step begins, manoeuvre, road of the hop that leaves it)
    boundaries: list[tuple[int, str, str | None]] = [(0, DEPART, hops[0][3])]
    for index in range(1, len(path) - 1):
        manoeuvre = classify_turn(bearings[index - 1], bearings[index])
        if manoeuvre != STRAIGHT:
            boundaries.append((index, manoeuvre, hops[index][3]))
    boundaries.append((len(path) - 1, ARRIVE, None))

    steps: list[RouteStep] = []
    for position, (index, manoeuvre, road_name) in enumerate(boundaries):
        is_arrival = manoeuvre == ARRIVE
        next_index = boundaries[position + 1][0] if not is_arrival else index
        distance = 0.0 if is_arrival else round(sum(hop[2] for hop in hops[index:next_index]), 2)
        steps.append(
            RouteStep(
                manoeuvre=manoeuvre,
                road_name=road_name,
                distance_m=distance,
                start_node_id=path[index],
                end_node_id=path[next_index],
                text=_instruction_text(
                    manoeuvre,
                    road_name,
                    bearings[index] if index < len(bearings) else 0.0,
                    node_names.get(path[next_index]),
                ),
            )
        )

    return steps


# ---------------------------------------------------------------------------
# Time-Dependent A* (TD-A*)
# ---------------------------------------------------------------------------


# A fresh, flagged sensor advisory never closes a road (BRULE-012), but it is a
# live signal the router should still prefer around when a safe alternative
# exists. A fixed time multiplier does that without touching the hard
# clearance block below, which only ever looks at simulated water depth.
ADVISORY_PENALTY = 1.5


def _max_graph_speed_kmh(
    graph_edges: dict[int, list[tuple[int, float, float, float, bool]]],
) -> float:
    """Fastest permitted speed anywhere in the graph (km/h)."""
    speeds = [speed for adjacency in graph_edges.values() for (_, _, speed, _, _) in adjacency]
    return max(speeds) if speeds else 50.0


def td_a_star_search(
    graph_nodes: dict[int, tuple[float, float]],  # node_id -> (lat, lon)
    graph_edges: dict[
        int, list[tuple[int, float, float, float, bool]]
    ],  # u -> [(v, length_m, speed_kmh, water_depth_cm, advisory_flagged)]
    start_node: int,
    target_node: int,
    vehicle_clearance_cm: float = 30.0,
    flood_aware: bool = True,
) -> tuple[list[int], float]:
    """
    Time-Dependent A* Pathfinding Engine with Min-Heap Priority Queue.
    Incorporate dynamic water depth penalties Omega(d_e), vehicle clearance
    thresholds, and a soft penalty for edges under a flagged sensor advisory.

    ``flood_aware=False`` is the dry-network personality (``FASTEST``): the same
    search on the posted speed limit alone. The clearance gate stays in both,
    because a road under water is never drivable whatever the mode says.

    Time Complexity: O(E log V)  -- guaranteed by the settled set below.
    Optimality:    guaranteed -- the heuristic divides by the fastest speed in
                   the graph, so it never overestimates remaining travel time;
                   the advisory penalty only ever raises a cost, never lowers
                   one, so the bound still holds.
    """
    if start_node not in graph_nodes or target_node not in graph_nodes:
        return [], float("inf")

    if start_node == target_node:
        return [start_node], 0.0

    def haversine(coord1: tuple[float, float], coord2: tuple[float, float]) -> float:
        R = 6371000.0  # Earth radius in meters
        lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
        lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    target_coord = graph_nodes[target_node]
    # Admissible heuristic: no vehicle can beat the graph's top speed, so
    # distance / max_speed is a guaranteed lower bound on remaining time.
    max_speed_m_s = max(_max_graph_speed_kmh(graph_edges) / 3.6, 0.1)

    def heuristic(node_id: int) -> float:
        return haversine(graph_nodes[node_id], target_coord) / max_speed_m_s

    g_score: dict[int, float] = {node: float("inf") for node in graph_nodes}
    g_score[start_node] = 0.0

    came_from: dict[int, int] = {}
    settled: set = set()

    # Heap entries carry their own g so stale duplicates can be discarded.
    pq: list[tuple[float, float, int]] = [(heuristic(start_node), 0.0, start_node)]

    while pq:
        _, current_g, current = heapq.heappop(pq)

        # A cheaper path to this node was already processed.
        if current in settled or current_g > g_score.get(current, float("inf")):
            continue
        settled.add(current)

        if current == target_node:
            path: list[int] = []
            cursor = target_node
            while cursor in came_from:
                path.append(cursor)
                cursor = came_from[cursor]
            path.append(start_node)
            return path[::-1], g_score[target_node]

        for neighbor, length_m, speed_kmh, water_depth_cm, advisory_flagged in graph_edges.get(
            current, []
        ):
            # Passability threshold: infinite penalty if water exceeds clearance.
            # Both modes keep it -- see the docstring.
            if water_depth_cm >= vehicle_clearance_cm:
                continue

            # Exponential speed degradation as standing water deepens; FASTEST
            # mode is the posted limit alone.
            water_penalty = 1.0 + math.pow(water_depth_cm / 10.0, 1.8) if flood_aware else 1.0
            effective_speed_m_s = max((speed_kmh / 3.6) / water_penalty, 0.5)

            traversal_time_s = length_m / effective_speed_m_s
            if flood_aware and advisory_flagged:
                traversal_time_s *= ADVISORY_PENALTY
            tentative_g = current_g + traversal_time_s

            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                heapq.heappush(pq, (tentative_g + heuristic(neighbor), tentative_g, neighbor))

    return [], float("inf")  # No safe route found
