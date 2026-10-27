const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
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
  ).then((res) => res.user || (res as any));
}

export function register(data: {
  name: string;
  email: string;
  password: string;
  role?: string;
  verification_code?: string;
}): Promise<AuthUser> {
  return request<AuthUser>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
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
