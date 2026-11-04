import { fetchBlob } from "./api";

export async function exportAuditCSV(actionType?: string, userId?: number): Promise<Blob> {
  const params = new URLSearchParams();
  if (actionType) params.append("action_type", actionType);
  if (userId) params.append("user_id", userId.toString());

  return fetchBlob(`/api/v1/audit/export${params.toString() ? `?${params}` : ""}`);
}

export async function exportIncidentsCSV(status?: string): Promise<Blob> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);

  return fetchBlob(`/api/v1/incidents/export${params.toString() ? `?${params}` : ""}`);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
