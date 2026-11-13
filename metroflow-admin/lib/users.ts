import { fetchJSON } from "./api";

export type User = {
  user_id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "RESPONDER" | "PUBLIC_DRIVER";
  /** The rescue unit a driver account reports as; null for portal accounts. */
  vehicle_id: number | null;
  created_at: string | null;
};

export type UserCreate = {
  name: string;
  email: string;
  password: string;
  role: "SUPER_ADMIN" | "ADMIN" | "RESPONDER" | "PUBLIC_DRIVER";
  vehicle_id?: number | null;
};

export type UserUpdate = {
  name?: string;
  email?: string;
  role?: "SUPER_ADMIN" | "ADMIN" | "RESPONDER" | "PUBLIC_DRIVER";
  vehicle_id?: number | null;
};

export async function listUsers(): Promise<User[]> {
  return fetchJSON<User[]>("/api/v1/users");
}

export async function createUser(user: UserCreate): Promise<User> {
  return fetchJSON<User>("/api/v1/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
}

export async function updateUser(userId: number, user: UserUpdate): Promise<User> {
  return fetchJSON<User>(`/api/v1/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(user),
  });
}

export async function deleteUser(userId: number): Promise<void> {
  return fetchJSON<void>(`/api/v1/users/${userId}`, {
    method: "DELETE",
  });
}
