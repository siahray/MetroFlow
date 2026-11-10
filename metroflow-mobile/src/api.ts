const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";

/** The bearer token for the current app session; null for guests. */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** The current session token, for transports that cannot use `request`. */
export function getAuthToken(): string | null {
  return authToken;
}

/** Absolute URL for a path, used by the streaming client. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  status: number;
  retryAfterSeconds: number | null;

  constructor(status: number, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function parseRetryAfter(res: Response): number | null {
  const raw = res.headers.get("Retry-After");
  if (!raw) return null;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * Turn a failed response into a message the driver can act on.
 *
 * The API refuses an over-limit request with a 429 and a `Retry-After` header;
 * showing the raw JSON body would tell a driver nothing, and "check your
 * connection" would be wrong advice for a limit they simply have to wait out.
 */
async function readError(res: Response): Promise<ApiError> {
  const retryAfter = parseRetryAfter(res);

  if (res.status === 429) {
    const wait =
      retryAfter === null
        ? 'Please wait a moment and try again.'
        : `Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`;
    return new ApiError(429, `Too many requests. ${wait}`, retryAfter);
  }

  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const detail = (JSON.parse(text) as { detail?: unknown } | null)?.detail;
      if (typeof detail === 'string' && detail.trim()) {
        return new ApiError(res.status, detail, retryAfter);
      }
    } catch {
      // Not JSON: fall through and use the body verbatim.
    }
    return new ApiError(res.status, text, retryAfter);
  }

  return new ApiError(res.status, `Request failed: ${res.status}`, retryAfter);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    throw await readError(res);
  }
  // 204 No Content — return undefined cast to T (caller must not use the value).
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export type AuthUser = {
  user_id: number;
  name: string;
  email: string;
  role: string;
  /** The rescue unit this driver reports as; null for guests and office roles. */
  vehicle_id: number | null;
};

export type SOSRequest = {
  sos_id: number;
  latitude: number;
  longitude: number;
  note: string | null;
  vehicle_id: number | null;
  status: string;
  created_at: string | null;
};

export function login(email: string, password: string): Promise<AuthUser> {
  return request<{ access_token: string; token_type: string; user: AuthUser }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
  ).then((res) => {
    // Every route except the auth entry points requires this token (TSD
    // LIM-022), so it is kept for the app session rather than discarded.
    setAuthToken(res.access_token);
    return res.user;
  });
}

/** Update the signed-in user's own display name (P2-7). */
export function updateMyName(name: string): Promise<AuthUser> {
  return request<AuthUser>("/api/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  role?: string;
  verification_code?: string;
}): Promise<AuthUser> {
  await request<AuthUser>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
  // Registration returns the account, not a token, so sign in to get one.
  return login(data.email, data.password);
}

export function sendVerification(email: string): Promise<{ message: string; code?: string }> {
  return request<{ message: string; code?: string }>("/api/v1/auth/send-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function createSOS(data: {
  latitude: number;
  longitude: number;
  note?: string;
}): Promise<SOSRequest> {
  return request<SOSRequest>("/api/v1/sos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listMySOS(): Promise<SOSRequest[]> {
  return request<SOSRequest[]>("/api/v1/sos");
}

export function getSOS(sosId: number): Promise<SOSRequest> {
  return request<SOSRequest>(`/api/v1/sos/${sosId}`);
}

export type Vehicle = {
  vehicle_id: number;
  call_sign: string;
  vehicle_type: string;
  clearance_cm: number | null;
  status: string;
  current_location_lat: number | null;
  current_location_lon: number | null;
  speed_kmh: number | null;
};

export function listVehicles(): Promise<Vehicle[]> {
  return request<Vehicle[]>("/api/v1/vehicles");
}

// ---------------------------------------------------------------------------
// Missions (FSD-FR-074)
// ---------------------------------------------------------------------------

/**
 * The incident this unit is currently dispatched to, or null.
 *
 * A dispatcher assigns the unit in the portal; the app discovers its own
 * mission here so it never needs to see the whole SOS queue.
 */
export function getMission(vehicleId: number): Promise<SOSRequest | null> {
  return request<SOSRequest | null>(`/api/v1/vehicles/${vehicleId}/mission`);
}

/** Mark the unit on scene; the incident stays open until resolve (FSD-FR-087 to 089). */
export function arriveSOS(sosId: number): Promise<SOSRequest> {
  return request<SOSRequest>(`/api/v1/sos/${sosId}/arrive`, { method: "POST" });
}

/** Close the incident once the unit is on scene (FSD-FR-046). */
export function resolveSOS(sosId: number): Promise<SOSRequest> {
  return request<SOSRequest>(`/api/v1/sos/${sosId}/resolve`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Vehicle telemetry (FSD-FR-072)
// ---------------------------------------------------------------------------

/**
 * Post a position/speed batch from the driver app.
 *
 * The server returns 204 No Content on success and 429 when the throttle
 * window has not yet elapsed (VAL-020).  Callers should fire-and-forget;
 * failures are logged but never surface to the UI.
 */
export function postTelemetry(
  vehicleId: number,
  data: {
    latitude: number;
    longitude: number;
    speed_kmh?: number | null;
    heading?: number | null;
    recorded_at?: string | null;
  },
): Promise<void> {
  return request<void>(`/api/v1/vehicles/${vehicleId}/telemetry`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Road network, routes and hazards (FSD-FR-054 to 064)
// ---------------------------------------------------------------------------

export type GeoJsonPoint = {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
};

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: [number, number][][];
};

export type NodeFeature = {
  id: number;
  geometry: GeoJsonPoint;
  properties: { node_id: number; name: string | null; elevation_m: number };
};

export type EdgeFeature = {
  id: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: {
    edge_id: number;
    start_node_id: number;
    end_node_id: number;
    start_name: string | null;
    end_name: string | null;
    road_name: string | null;
    distance_m: number;
    max_speed_kmh: number;
    avg_speed_kmh: number;
    water_depth_cm: number;
    status: "PASSABLE" | "LIGHT_FLOOD" | "SUBMERGED";
    is_override: boolean;
  };
};

export type NetworkState = {
  clearance_cm: number;
  generated_at: string;
  edges: { type: "FeatureCollection"; features: EdgeFeature[] };
  nodes: { type: "FeatureCollection"; features: NodeFeature[] };
};

export type HazardInfo = {
  hazard_id: number;
  name: string;
  obstruction_level: string;
  avg_depth_cm: number | null;
  edge_id: number | null;
  notes: string | null;
  geometry: GeoJsonPolygon | null;
  warning_radius_m: number;
  published_at: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RouteInstruction = {
  manoeuvre:
    | "DEPART"
    | "ARRIVE"
    | "STRAIGHT"
    | "TURN_LEFT"
    | "TURN_RIGHT"
    | "SLIGHT_LEFT"
    | "SLIGHT_RIGHT"
    | "U_TURN";
  road_name: string | null;
  distance_m: number;
  start_node_id: number;
  end_node_id: number;
  text: string;
};

export type RouteHazard = {
  hazard_id: number;
  name: string;
  obstruction_level: string;
  avg_depth_cm: number | null;
  edge_id: number | null;
  blocking: boolean;
  geometry: GeoJsonPolygon | null;
  warning_radius_m: number;
};

export type RouteSegment = {
  edge_id: number;
  start_node_id: number;
  end_node_id: number;
  road_name: string | null;
  distance_m: number;
  water_depth_cm: number;
  status: "PASSABLE" | "LIGHT_FLOOD" | "SUBMERGED";
};

export type RoutePlan = {
  start_node: number;
  target_node: number;
  destination_name: string | null;
  vehicle_clearance_cm: number;
  optimal_path_nodes: number[];
  geometry: { type: "LineString"; coordinates: [number, number][] };
  segments: RouteSegment[];
  instructions: RouteInstruction[];
  hazards: RouteHazard[];
  total_distance_m: number;
  estimated_travel_time_minutes: number;
};

export function getNetworkState(clearanceCm: number): Promise<NetworkState> {
  return request<NetworkState>(
    `/api/v1/network/state?clearance_cm=${encodeURIComponent(clearanceCm)}`,
  );
}

export function getRoute(params: {
  start_node: number;
  target_node: number;
  clearance_cm: number;
  ignore_hazards?: boolean;
}): Promise<RoutePlan> {
  const query = new URLSearchParams({
    start_node: String(params.start_node),
    target_node: String(params.target_node),
    clearance_cm: String(params.clearance_cm),
  });
  if (params.ignore_hazards) query.set("ignore_hazards", "true");
  return request<RoutePlan>(`/api/v1/routing/navigate?${query.toString()}`);
}

export function listActiveHazards(): Promise<HazardInfo[]> {
  return request<HazardInfo[]>("/api/v1/hazards/active");
}

/** Resolved per-segment flood state, with source and freshness (CR-004). */
export type FloodStateEdge = {
  edge_id: number;
  basis: "VERIFIED_HAZARD" | "LIVE_ADVISORY" | "NOAH_CAUTION" | "NOAH_LAYER" | "NONE";
  source: string | null;
  kind: "OBSERVED" | "MODELLED" | "SIMULATED" | "STATIC" | null;
  as_of: string | null;
  has_live_data: boolean;
  stale: boolean;
  advisory: boolean;
  closes_road: boolean;
  route_penalty: number;
  notes: string[];
};

export type FloodStateResponse = {
  generated_at: string;
  raining: boolean;
  fresh_window_minutes: number;
  edges: FloodStateEdge[];
};

export function getFloodState(onlyFlagged = true): Promise<FloodStateResponse> {
  return request<FloodStateResponse>(`/api/v1/flood-state?only_flagged=${onlyFlagged}`);
}

// ---------------------------------------------------------------------------
// Field reports (FSD-FR-065 to 067)
// ---------------------------------------------------------------------------

/** The depth bands the moderation desk accepts (BR-014). */
export type ReportDepth = "ANKLE" | "KNEE" | "IMPASSABLE";

/** A photo the picker handed back, in the shape React Native uploads it. */
export type ReportPhoto = {
  uri: string;
  name: string;
  type: string;
};

export type ReportCreated = {
  report_id: string;
  status: string;
  depth_level: string;
  depth_label: string;
  possible_duplicate_of: string | null;
  captured_at: string | null;
  submitted_at: string | null;
};

/** One of the driver's own past field reports (P3-5). */
export type MyReport = {
  report_id: string;
  depth_level: string;
  depth_label: string;
  status: string;
  barangay: string | null;
  narrative: string | null;
  captured_at: string | null;
  submitted_at: string | null;
  decision_reason: string | null;
};

/** The driver's own report history, most recent first. */
export function listMyReports(): Promise<MyReport[]> {
  return request<MyReport[]>("/api/v1/reports/mine");
}

/**
 * Submit a field report as multipart form data (FSD-FR-065 to 067).
 *
 * `captured_at` is the moment the driver recorded the water level, not the
 * moment the queue happened to accept the upload. The photo is streamed as a
 * file part, so the request must not set `Content-Type`: fetch has to generate
 * the multipart boundary itself.
 */
export async function submitReport(input: {
  depthLevel: ReportDepth;
  latitude: number;
  longitude: number;
  narrative?: string | null;
  barangay?: string | null;
  capturedAt?: string | null;
  photo?: ReportPhoto | null;
  clientId?: string;
}): Promise<ReportCreated> {
  const form = new FormData();
  form.append("depth_level", input.depthLevel);
  form.append("latitude", String(input.latitude));
  form.append("longitude", String(input.longitude));
  if (input.narrative?.trim()) form.append("narrative", input.narrative.trim());
  if (input.barangay?.trim()) form.append("barangay", input.barangay.trim());
  if (input.capturedAt) form.append("captured_at", input.capturedAt);
  if (input.clientId) form.append("client_id", input.clientId);
  if (input.photo) {
    // React Native's FormData accepts this descriptor as a file part.
    form.append("photo", input.photo as unknown as Blob);
  }

  const headers = new Headers();
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const res = await fetch(`${API_BASE_URL}/api/v1/reports`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    throw await readError(res);
  }
  return (await res.json()) as ReportCreated;
}
