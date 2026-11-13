// Offline route planning (FSD-FR-071): the same Time-Dependent A* the API runs
// in backend/routing.py, ported to run over the cached graph (network.ts /
// offline.ts) when there is no connection. Mirrors the server's cost function,
// hazard blocking rule (BRULE-008) and turn-by-turn instructions so a route
// planned offline matches the one the API would have returned.
import type {
  EdgeFeature,
  HazardInfo,
  NetworkState,
  RouteHazard,
  RouteInstruction,
  RoutePlan,
  RouteSegment,
} from "../api";
import { distanceMeters, toLatLng, type LatLng } from "./geo";

const BLOCKING_LEVELS = new Set(["LEVEL_2", "LEVEL_3", "IMPASSABLE"]);

type Hop = { neighbor: number; edge: EdgeFeature; forward: boolean };

function blockedEdgeIds(hazards: HazardInfo[]): Set<number> {
  const blocked = new Set<number>();
  for (const hazard of hazards) {
    if (
      hazard.edge_id != null &&
      hazard.active !== false &&
      BLOCKING_LEVELS.has(hazard.obstruction_level.toUpperCase())
    ) {
      blocked.add(hazard.edge_id);
    }
  }
  return blocked;
}

function buildAdjacency(network: NetworkState, blocked: Set<number>): Map<number, Hop[]> {
  const adjacency = new Map<number, Hop[]>();
  const add = (from: number, to: number, edge: EdgeFeature, forward: boolean) => {
    const list = adjacency.get(from);
    const hop = { neighbor: to, edge, forward };
    if (list) list.push(hop);
    else adjacency.set(from, [hop]);
  };
  for (const edge of network.edges.features) {
    if (blocked.has(edge.properties.edge_id)) continue;
    const { start_node_id, end_node_id } = edge.properties;
    add(start_node_id, end_node_id, edge, true);
    add(end_node_id, start_node_id, edge, false);
  }
  return adjacency;
}

/** Time-Dependent A*, ported from backend/routing.py::td_a_star_search.
 *
 * ``floodAware`` mirrors the server's two modes: with no flood anywhere the
 * planner uses the posted speed limit alone, exactly like a normal map app.
 */
function aStarSearch(
  network: NetworkState,
  adjacency: Map<number, Hop[]>,
  nodeCoords: Map<number, LatLng>,
  startNode: number,
  targetNode: number,
  clearanceCm: number,
  floodAware: boolean,
): { path: number[]; hops: Hop[]; seconds: number } | null {
  if (!nodeCoords.has(startNode) || !nodeCoords.has(targetNode)) return null;
  if (startNode === targetNode) return { path: [startNode], hops: [], seconds: 0 };

  const maxSpeedKmh = Math.max(
    1,
    ...network.edges.features.map((edge) => edge.properties.max_speed_kmh),
  );
  const maxSpeedMs = maxSpeedKmh / 3.6;
  const target = nodeCoords.get(targetNode) as LatLng;
  const heuristic = (id: number) => distanceMeters(nodeCoords.get(id) as LatLng, target) / maxSpeedMs;

  const g = new Map<number, number>([[startNode, 0]]);
  const cameFrom = new Map<number, Hop>();
  const settled = new Set<number>();
  const open: { id: number; g: number; f: number }[] = [
    { id: startNode, g: 0, f: heuristic(startNode) },
  ];

  while (open.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i].f < open[bestIndex].f) bestIndex = i;
    const current = open.splice(bestIndex, 1)[0];

    if (settled.has(current.id) || current.g > (g.get(current.id) ?? Infinity)) continue;
    settled.add(current.id);

    if (current.id === targetNode) {
      const path = [targetNode];
      const hops: Hop[] = [];
      let cursor = targetNode;
      while (cameFrom.has(cursor)) {
        const hop = cameFrom.get(cursor) as Hop;
        hops.unshift(hop);
        cursor = hop.forward ? hop.edge.properties.start_node_id : hop.edge.properties.end_node_id;
        path.unshift(cursor);
      }
      return { path, hops, seconds: g.get(targetNode) as number };
    }

    for (const hop of adjacency.get(current.id) ?? []) {
      const { water_depth_cm, max_speed_kmh, distance_m } = hop.edge.properties;
      if (water_depth_cm >= clearanceCm) continue;
      const waterPenalty = floodAware ? 1.0 + Math.pow(water_depth_cm / 10.0, 1.8) : 1.0;
      const effectiveSpeedMs = Math.max(max_speed_kmh / 3.6 / waterPenalty, 0.5);
      const tentative = current.g + distance_m / effectiveSpeedMs;
      if (tentative < (g.get(hop.neighbor) ?? Infinity)) {
        g.set(hop.neighbor, tentative);
        cameFrom.set(hop.neighbor, hop);
        open.push({ id: hop.neighbor, g: tentative, f: tentative + heuristic(hop.neighbor) });
      }
    }
  }
  return null;
}

// --- Turn-by-turn instructions, ported from build_instructions ------------

const STRAIGHT_THRESHOLD_DEG = 20.0;
const SLIGHT_TURN_THRESHOLD_DEG = 45.0;
const U_TURN_THRESHOLD_DEG = 135.0;
const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

function bearingDegrees(start: LatLng, end: LatLng): number {
  const lat1 = (start.latitude * Math.PI) / 180;
  const lon1 = (start.longitude * Math.PI) / 180;
  const lat2 = (end.latitude * Math.PI) / 180;
  const lon2 = (end.longitude * Math.PI) / 180;
  const deltaLon = lon2 - lon1;
  const x = Math.sin(deltaLon) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

function compassPoint(bearing: number): string {
  return COMPASS[Math.round(((bearing % 360) / 45 + 8) % 8)];
}

function classifyTurn(previousBearing: number, nextBearing: number): RouteInstruction["manoeuvre"] {
  const delta = ((nextBearing - previousBearing + 540) % 360) - 180;
  const magnitude = Math.abs(delta);
  if (magnitude <= STRAIGHT_THRESHOLD_DEG) return "STRAIGHT";
  if (magnitude >= U_TURN_THRESHOLD_DEG) return "U_TURN";
  const right = delta > 0;
  if (magnitude <= SLIGHT_TURN_THRESHOLD_DEG) return right ? "SLIGHT_RIGHT" : "SLIGHT_LEFT";
  return right ? "TURN_RIGHT" : "TURN_LEFT";
}

function instructionText(
  manoeuvre: RouteInstruction["manoeuvre"],
  roadName: string | null,
  startBearing: number,
  destinationName: string | null,
): string {
  const road = roadName || "the road";
  switch (manoeuvre) {
    case "DEPART":
      return `Head ${compassPoint(startBearing)} on ${road}`;
    case "TURN_LEFT":
      return `Turn left onto ${road}`;
    case "TURN_RIGHT":
      return `Turn right onto ${road}`;
    case "SLIGHT_LEFT":
      return `Bear left onto ${road}`;
    case "SLIGHT_RIGHT":
      return `Bear right onto ${road}`;
    case "U_TURN":
      return `Make a U-turn onto ${road}`;
    default:
      return `Arrive at ${destinationName || "your destination"}`;
  }
}

type RouteHop = { start: number; end: number; distanceM: number; roadName: string | null };

function buildInstructions(
  path: number[],
  hops: RouteHop[],
  nodeCoords: Map<number, LatLng>,
  nodeNames: Map<number, string | null>,
): RouteInstruction[] {
  if (path.length === 0) return [];
  if (hops.length === 0) {
    return [
      {
        manoeuvre: "ARRIVE",
        road_name: null,
        distance_m: 0,
        start_node_id: path[0],
        end_node_id: path[0],
        text: instructionText("ARRIVE", null, 0, nodeNames.get(path[0]) ?? null),
      },
    ];
  }

  let bearings = hops.map((hop) =>
    nodeCoords.has(hop.start) && nodeCoords.has(hop.end)
      ? bearingDegrees(nodeCoords.get(hop.start) as LatLng, nodeCoords.get(hop.end) as LatLng)
      : null,
  );
  if (bearings.some((b) => b === null)) bearings = hops.map(() => 0);
  const bearingValues = bearings as number[];

  const boundaries: { index: number; manoeuvre: RouteInstruction["manoeuvre"]; roadName: string | null }[] = [
    { index: 0, manoeuvre: "DEPART", roadName: hops[0].roadName },
  ];
  for (let index = 1; index < path.length - 1; index += 1) {
    const manoeuvre = classifyTurn(bearingValues[index - 1], bearingValues[index]);
    if (manoeuvre !== "STRAIGHT") {
      boundaries.push({ index, manoeuvre, roadName: hops[index].roadName });
    }
  }
  boundaries.push({ index: path.length - 1, manoeuvre: "ARRIVE", roadName: null });

  const steps: RouteInstruction[] = [];
  for (let position = 0; position < boundaries.length; position += 1) {
    const { index, manoeuvre, roadName } = boundaries[position];
    const isArrival = manoeuvre === "ARRIVE";
    const nextIndex = isArrival ? index : boundaries[position + 1].index;
    const distance = isArrival
      ? 0
      : Math.round(
          hops.slice(index, nextIndex).reduce((sum, hop) => sum + hop.distanceM, 0) * 100,
        ) / 100;
    steps.push({
      manoeuvre,
      road_name: roadName,
      distance_m: distance,
      start_node_id: path[index],
      end_node_id: path[nextIndex],
      text: instructionText(
        manoeuvre,
        roadName,
        bearingValues[index] ?? 0,
        nodeNames.get(path[nextIndex]) ?? null,
      ),
    });
  }
  return steps;
}

/**
 * Plan a route over the cached graph without the network. Returns null when
 * the graph is missing the requested nodes or no safe path exists (the caller
 * treats that the same as the API's 404).
 */
export function planRouteOffline(
  network: NetworkState,
  hazards: HazardInfo[],
  startNode: number,
  targetNode: number,
  clearanceCm: number,
  ignoreHazards = false,
  forcedMode?: "FASTEST" | "FLOOD_SAFE",
): RoutePlan | null {
  const allBlocked = blockedEdgeIds(hazards);
  const blocked = ignoreHazards ? new Set<number>() : allBlocked;
  // Mirrors backend routing.routing_mode: any non-passable segment (which is
  // what the cached status means) or a closure keeps the flood-aware cost, even
  // when the caller asks to route through the closure. A caller that forced a
  // mode (normal map view) gets exactly that mode.
  const floodAware =
    forcedMode === undefined
      ? allBlocked.size > 0 ||
        network.edges.features.some((edge) => edge.properties.status !== "PASSABLE")
      : forcedMode === "FLOOD_SAFE";
  const adjacency = buildAdjacency(network, blocked);
  const nodeCoords = new Map<number, LatLng>();
  const nodeNames = new Map<number, string | null>();
  for (const node of network.nodes.features) {
    nodeCoords.set(node.properties.node_id, toLatLng(node.geometry.coordinates));
    nodeNames.set(node.properties.node_id, node.properties.name);
  }

  const result = aStarSearch(
    network,
    adjacency,
    nodeCoords,
    startNode,
    targetNode,
    clearanceCm,
    floodAware,
  );
  if (!result) return null;
  const { path, hops: searchHops, seconds } = result;

  const coordinates: [number, number][] = [];
  const segments: RouteSegment[] = [];
  const hops: RouteHop[] = [];
  const traversedEdges = new Set<number>();

  if (path.length === 1) {
    const point = network.nodes.features.find((n) => n.properties.node_id === path[0]);
    const xy: [number, number] = point ? point.geometry.coordinates : [0, 0];
    coordinates.push(xy, xy);
  } else {
    for (let i = 0; i < searchHops.length; i += 1) {
      const hop = searchHops[i];
      const edge = hop.edge;
      traversedEdges.add(edge.properties.edge_id);
      let hopCoordinates = edge.geometry.coordinates;
      if (!hop.forward) hopCoordinates = [...hopCoordinates].reverse();

      if (coordinates.length === 0) coordinates.push(...hopCoordinates);
      else if (
        coordinates[coordinates.length - 1][0] === hopCoordinates[0][0] &&
        coordinates[coordinates.length - 1][1] === hopCoordinates[0][1]
      ) {
        coordinates.push(...hopCoordinates.slice(1));
      } else {
        coordinates.push(...hopCoordinates);
      }

      const start = hop.forward ? edge.properties.start_node_id : edge.properties.end_node_id;
      const end = hop.forward ? edge.properties.end_node_id : edge.properties.start_node_id;
      segments.push({
        edge_id: edge.properties.edge_id,
        start_node_id: start,
        end_node_id: end,
        road_name: edge.properties.road_name,
        distance_m: Math.round(edge.properties.distance_m * 100) / 100,
        water_depth_cm: edge.properties.water_depth_cm,
        status: edge.properties.status,
      });
      hops.push({ start, end, distanceM: edge.properties.distance_m, roadName: edge.properties.road_name });
    }
  }

  const instructions = buildInstructions(path, hops, nodeCoords, nodeNames);

  const routeHazards: RouteHazard[] = hazards
    .filter((hazard) => hazard.edge_id != null && traversedEdges.has(hazard.edge_id))
    .sort((a, b) => a.hazard_id - b.hazard_id)
    .map((hazard) => ({
      hazard_id: hazard.hazard_id,
      name: hazard.name,
      obstruction_level: hazard.obstruction_level,
      avg_depth_cm: hazard.avg_depth_cm,
      edge_id: hazard.edge_id,
      blocking: BLOCKING_LEVELS.has(hazard.obstruction_level.toUpperCase()),
      geometry: hazard.geometry,
      warning_radius_m: hazard.warning_radius_m,
    }));

  return {
    start_node: startNode,
    target_node: targetNode,
    destination_name: nodeNames.get(targetNode) ?? null,
    vehicle_clearance_cm: clearanceCm,
    optimal_path_nodes: path,
    geometry: { type: "LineString", coordinates },
    segments,
    instructions,
    hazards: routeHazards,
    total_distance_m: Math.round(hops.reduce((sum, hop) => sum + hop.distanceM, 0) * 100) / 100,
    estimated_travel_time_minutes: Math.round((seconds / 60) * 100) / 100,
    routing_mode: floodAware ? "FLOOD_SAFE" : "FASTEST",
    // The offline planner is always this same JS port of the in-house
    // engine -- there is no Mapbox fallback without a network connection.
    source: "ENGINE",
  };
}
