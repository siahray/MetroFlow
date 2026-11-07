import { fetchJSON } from "./api";

/**
 * Typed client for the road-network endpoints (TSD §5.3, LIM-014).
 *
 * The API answers with GeoJSON FeatureCollections so the portal can hand the
 * payloads straight to MapLibre: edges carry the live flood depth and the
 * passability verdict for the requested clearance, nodes carry names and
 * elevations. There is no client-side recomputation of either.
 */

/** The three verdicts `routing.classify_passability` can return. */
export type PassabilityStatus = "PASSABLE" | "LIGHT_FLOOD" | "SUBMERGED";

/** GeoJSON coordinate order: longitude first. */
export type LngLat = [number, number];

export type EdgeProperties = {
  edge_id: number;
  start_node_id: number;
  end_node_id: number;
  start_name: string | null;
  end_name: string | null;
  distance_m: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  water_depth_cm: number;
  status: PassabilityStatus;
  is_override: boolean;
};

export type NodeProperties = {
  node_id: number;
  name: string | null;
  elevation_m: number;
};

export type EdgeFeature = {
  type: "Feature";
  id: number;
  geometry: { type: "LineString"; coordinates: LngLat[] };
  properties: EdgeProperties;
};

export type NodeFeature = {
  type: "Feature";
  id: number;
  geometry: { type: "Point"; coordinates: LngLat };
  properties: NodeProperties;
};

export type EdgeFeatureCollection = {
  type: "FeatureCollection";
  features: EdgeFeature[];
};

export type NodeFeatureCollection = {
  type: "FeatureCollection";
  features: NodeFeature[];
};

/** `NetworkStateResponse`. */
export type NetworkState = {
  clearance_cm: number;
  generated_at: string;
  edges: EdgeFeatureCollection;
  nodes: NodeFeatureCollection;
};

/** `SimulationResponse`: the simulation summary plus the resulting network. */
export type SimulationResult = NetworkState & {
  rainfall_mm_hr: number;
  runoff_mm: number;
  affected_edges: number;
  message: string;
};

/** `RouteSegment`. */
export type RouteSegment = {
  edge_id: number;
  start_node_id: number;
  end_node_id: number;
  water_depth_cm: number;
  status: PassabilityStatus;
};

/** `RouteResponse` from the Time-Dependent A* search. */
export type RouteResult = {
  start_node: number;
  target_node: number;
  vehicle_clearance_cm: number;
  optimal_path_nodes: number[];
  geometry: { type: "LineString"; coordinates: LngLat[] };
  segments: RouteSegment[];
  estimated_travel_time_minutes: number;
};

/** What the editor outside the map displays about the network it is showing. */
export type NetworkSummary = {
  clearanceCm: number;
  passable: number;
  lightFlood: number;
  submerged: number;
  nodeCount: number;
  edgeCount: number;
  route: { nodes: number; minutes: number; path: number[] } | null;
};

/**
 * One palette for the map, the legend and the editor badges, so a status can
 * never mean green on the map and amber in the sidebar.
 */
export const STATUS_COLORS: Record<PassabilityStatus, string> = {
  PASSABLE: "#059669",
  LIGHT_FLOOD: "#d97706",
  SUBMERGED: "#e11d48",
};

export const STATUS_LABELS: Record<PassabilityStatus, string> = {
  PASSABLE: "Passable",
  LIGHT_FLOOD: "Light flood",
  SUBMERGED: "Submerged",
};

/**
 * The colours the canvas paints with. MapLibre paint specs and the popup's DOM
 * styles need literal strings, so these cannot be Tailwind classes; keeping
 * them here means the overlays, the draft shape and the popup cannot drift
 * apart. Hues follow the driver app's obstruction language, not brand tokens.
 */
export const MAP_COLORS = {
  /** Text and node outlines. */
  ink: "#0f172a",
  /** Secondary popup text. */
  inkMuted: "#475569",
  /** Label halos and node fill. */
  paper: "#ffffff",
  /** Casing under the road lines. */
  casing: "#f8fafc",
  /** Planned route halo, and a healthy sensor. */
  accent: "#0ea5e9",
  /** Planned route line and endpoints. */
  route: "#0369a1",
  /** Hazards, worst first; `alert` also carries the SOS dots. */
  hazardImpassable: "#7f1d1d",
  hazardSevere: "#b91c1c",
  alert: "#dc2626",
  /** Default hazard, a breached sensor, and the draft shape. */
  warning: "#f59e0b",
  /** Fleet unit and its label. */
  unit: "#2563eb",
  unitLabel: "#1e3a8a",
  sosLabel: "#991b1b",
  /** Sensor label ink; a disabled sensor is `sensorOff`. */
  sensorLabel: "#0c4a6e",
  sensorOff: "#94a3b8",
} as const;

function numberParam(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

/** Fetch every edge and node rendered for one vehicle clearance profile. */
export async function fetchNetworkState(
  clearanceCm: number,
  signal?: AbortSignal,
): Promise<NetworkState> {
  return fetchJSON<NetworkState>(
    `/api/v1/network/state?clearance_cm=${encodeURIComponent(numberParam(clearanceCm))}`,
    { signal },
  );
}

/**
 * Run the SCS-CN rainfall simulation.
 *
 * The response already contains the recomputed network, so the caller can
 * recolor the map without a second round trip. Admin-only on the API.
 */
export async function runRainfallSimulation(
  rainfallMmHr: number,
  clearanceCm: number,
): Promise<SimulationResult> {
  return fetchJSON<SimulationResult>(
    `/api/v1/simulation/rain?rainfall_mm_hr=${encodeURIComponent(
      numberParam(rainfallMmHr),
    )}&clearance_cm=${encodeURIComponent(numberParam(clearanceCm))}`,
    { method: "POST" },
  );
}

/** Ask the Time-Dependent A* search for a route under the same clearance. */
export async function fetchRoute(
  startNode: number,
  targetNode: number,
  clearanceCm: number,
): Promise<RouteResult> {
  return fetchJSON<RouteResult>(
    `/api/v1/routing/navigate?start_node=${encodeURIComponent(
      String(startNode),
    )}&target_node=${encodeURIComponent(String(targetNode))}&clearance_cm=${encodeURIComponent(
      numberParam(clearanceCm),
    )}`,
  );
}

/** Count the verdicts in a network payload for the legend and the status bar. */
export function summariseNetwork(
  state: NetworkState,
  route: RouteResult | null = null,
): NetworkSummary {
  let passable = 0;
  let lightFlood = 0;
  let submerged = 0;

  for (const feature of state.edges.features) {
    if (feature.properties.status === "SUBMERGED") submerged += 1;
    else if (feature.properties.status === "LIGHT_FLOOD") lightFlood += 1;
    else passable += 1;
  }

  return {
    clearanceCm: state.clearance_cm,
    passable,
    lightFlood,
    submerged,
    nodeCount: state.nodes.features.length,
    edgeCount: state.edges.features.length,
    route: route
      ? {
          nodes: route.optimal_path_nodes.length,
          minutes: route.estimated_travel_time_minutes,
          path: route.optimal_path_nodes,
        }
      : null,
  };
}

/** Depth as metres when it is deep enough for that to read better. */
export function formatDepthCm(cm: number): string {
  return cm >= 100 ? `${(cm / 100).toFixed(1)} m` : `${Math.round(cm)} cm`;
}
