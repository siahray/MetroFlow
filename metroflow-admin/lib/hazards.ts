import { fetchJSON } from "./api";

export type HazardZone = {
  hazard_id: number;
  name: string;
  obstruction_level: string;
  avg_depth_cm: number | null;
  edge_id: number | null;
  notes: string | null;
  geometry?: { type: "Polygon"; coordinates: number[][][] } | null;
  warning_radius_m?: number;
  published_at: string | null;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export async function listHazards(active?: boolean): Promise<HazardZone[]> {
  const query = active === undefined ? "" : `?active=${active}`;
  return fetchJSON<HazardZone[]>(`/api/v1/hazards${query}`);
}

export async function createHazard(data: {
  name: string;
  obstruction_level: string;
  avg_depth_cm?: number;
  edge_id?: number | null;
  notes?: string | null;
}): Promise<HazardZone> {
  return fetchJSON<HazardZone>("/api/v1/hazards", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function publishHazard(hazardId: number): Promise<HazardZone> {
  return fetchJSON<HazardZone>(`/api/v1/hazards/${hazardId}/publish`, {
    method: "POST",
  });
}

export async function updateHazard(
  hazardId: number,
  data: Partial<
    Pick<HazardZone, "name" | "obstruction_level" | "avg_depth_cm" | "notes" | "active">
  >,
): Promise<HazardZone> {
  return fetchJSON<HazardZone>(`/api/v1/hazards/${hazardId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
