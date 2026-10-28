const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";

/** The bearer token for the current app session; null for guests. */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
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
  return (await res.json()) as T;
}

export type AuthUser = {
  user_id: number;
  name: string;
  email: string;
  role: string;
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

export function listVehicles(): Promise<unknown[]> {
  return request<unknown[]>("/api/v1/vehicles");
}
