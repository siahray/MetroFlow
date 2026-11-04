import { fetchJSON } from "./api";
import type { SOSRequest } from "./dispatch";

export async function listSOS(status?: string): Promise<SOSRequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const rows = await fetchJSON<SOSRequest[]>(`/api/v1/sos${query}`);
  // A resolved incident is closed: it belongs in the audit trail, not in a queue.
  return status ? rows : rows.filter((row) => row.status.toUpperCase() !== "RESOLVED");
}
