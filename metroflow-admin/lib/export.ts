export async function exportAuditCSV(actionType?: string, userId?: number): Promise<Blob> {
  const params = new URLSearchParams();
  if (actionType) params.append("action_type", actionType);
  if (userId) params.append("user_id", userId.toString());

  const response = await fetch(`/api/v1/audit/export${params.toString() ? `?${params}` : ""}`);
  if (!response.ok) throw new Error("Failed to export audit log");
  return response.blob();
}

export async function exportIncidentsCSV(status?: string): Promise<Blob> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);

  const response = await fetch(`/api/v1/incidents/export${params.toString() ? `?${params}` : ""}`);
  if (!response.ok) throw new Error("Failed to export incidents");
  return response.blob();
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
