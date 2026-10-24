import { fetchJSON } from "./api";
import type { Vehicle } from "./dispatch";

export async function listVehiclesLive(): Promise<Vehicle[]> {
  return fetchJSON<Vehicle[]>("/api/v1/vehicles");
}
