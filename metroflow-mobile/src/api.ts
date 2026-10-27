const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";

/** The bearer token for the current app session; null for guests. */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || `Request failed: ${res.status}`);
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
