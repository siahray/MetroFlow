import { fetchJSON } from "./api";
import type { SOSRequest } from "./dispatch";

export async function listSOS(status?: string): Promise<SOSRequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchJSON<SOSRequest[]>(`/api/v1/sos${query}`);
}
