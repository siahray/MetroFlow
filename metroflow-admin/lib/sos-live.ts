import { fetchJSON } from "./api";
import type { SOSRequest } from "./dispatch";

export async function listSOS(status?: string, dismissed = false): Promise<SOSRequest[]> {
  const params = new URLSearchParams({ dismissed: String(dismissed) });
  if (status) params.set("status", status);
  const rows = await fetchJSON<SOSRequest[]>(`/api/v1/sos?${params}`);
  // A resolved incident is closed: it belongs in the audit trail, not in a queue.
  return status ? rows : rows.filter((row) => row.status.toUpperCase() !== "RESOLVED");
}
