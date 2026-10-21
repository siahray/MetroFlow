import heapq
import math

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


# ---------------------------------------------------------------------------
# Time-Dependent A* (TD-A*)
# ---------------------------------------------------------------------------


def _max_graph_speed_kmh(
    graph_edges: dict[int, list[tuple[int, float, float, float]]],
) -> float:
    """Fastest permitted speed anywhere in the graph (km/h)."""
    speeds = [speed for adjacency in graph_edges.values() for (_, _, speed, _) in adjacency]
    return max(speeds) if speeds else 50.0


def td_a_star_search(
    graph_nodes: dict[int, tuple[float, float]],  # node_id -> (lat, lon)
    graph_edges: dict[
        int, list[tuple[int, float, float, float]]
    ],  # u -> [(v, length_m, speed_kmh, water_depth_cm)]
    start_node: int,
    target_node: int,
    vehicle_clearance_cm: float = 30.0,
) -> tuple[list[int], float]:
    """
    Time-Dependent A* Pathfinding Engine with Min-Heap Priority Queue.
    Incorporate dynamic water depth penalties Omega(d_e) and vehicle clearance
    thresholds.

    Time Complexity: O(E log V)  -- guaranteed by the settled set below.
    Optimality:    guaranteed -- the heuristic divides by the fastest speed in
                   the graph, so it never overestimates remaining travel time.
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

        for neighbor, length_m, speed_kmh, water_depth_cm in graph_edges.get(current, []):
            # Passability threshold: infinite penalty if water exceeds clearance.
            if water_depth_cm >= vehicle_clearance_cm:
                continue

            # Exponential speed degradation as standing water deepens.
            water_penalty = 1.0 + math.pow(water_depth_cm / 10.0, 1.8)
            effective_speed_m_s = max((speed_kmh / 3.6) / water_penalty, 0.5)

            traversal_time_s = length_m / effective_speed_m_s
            tentative_g = current_g + traversal_time_s

            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                heapq.heappush(pq, (tentative_g + heuristic(neighbor), tentative_g, neighbor))

    return [], float("inf")  # No safe route found
