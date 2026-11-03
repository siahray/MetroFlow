import { fetchJSON } from "./api";

export type SOSRequest = {
  sos_id: number;
  latitude: number;
  longitude: number;
  note: string | null;
  vehicle_id: number | null;
  status: string;
  created_at: string | null;
};

export type Vehicle = {
  vehicle_id: number;
  call_sign: string;
  vehicle_type: string;
  clearance_cm: number | null;
  status: string;
  current_location_lat: number | null;
  current_location_lon: number | null;
  speed_kmh: number | null;
};

export type IncidentLogItem = {
  log_id: number;
  time: string;
  created_at: string;
  action_type: string;
  actor_name: string;
  text: string;
  kind: "muted" | "action" | "note";
};

export type DispatchPreviewUnit = {
  vehicle_id: number;
  call_sign: string;
  total_distance_m: number | null;
  estimated_travel_time_minutes: number | null;
  destination_name: string | null;
  hazards: { hazard_id: number; name: string; obstruction_level: string; blocking: boolean }[];
  detail: string | null;
};

export type DispatchPreview = {
  sos_id: number;
  units: DispatchPreviewUnit[];
};

export async function previewDispatchRoute(
  sosId: number,
  vehicleId?: number,
): Promise<DispatchPreview> {
  const url = vehicleId
    ? `/api/v1/dispatch/${sosId}/preview?vehicle_id=${vehicleId}`
    : `/api/v1/dispatch/${sosId}/preview`;
  return fetchJSON<DispatchPreview>(url);
}

export async function listVehicles(): Promise<Vehicle[]> {
  return fetchJSON<Vehicle[]>("/api/v1/vehicles");
}

/** What the API accepts for a unit (super admin only). */
export type VehicleInput = {
  call_sign: string;
  vehicle_type: string;
  clearance_cm: number;
  status: string;
  current_location_lat?: number;
  current_location_lon?: number;
};

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  return fetchJSON<Vehicle>("/api/v1/vehicles", { method: "POST", body: JSON.stringify(input) });
}

export async function updateVehicle(
  vehicleId: number,
  input: Partial<VehicleInput>,
): Promise<Vehicle> {
  return fetchJSON<Vehicle>(`/api/v1/vehicles/${vehicleId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteVehicle(vehicleId: number): Promise<void> {
  await fetchJSON<void>(`/api/v1/vehicles/${vehicleId}`, { method: "DELETE" });
}

export async function assignSOS(sosId: number, vehicleId: number): Promise<SOSRequest> {
  return fetchJSON<SOSRequest>(`/api/v1/sos/${sosId}/assign`, {
    method: "POST",
    body: JSON.stringify({ vehicle_id: vehicleId }),
  });
}

export async function confirmDispatch(sosId: number, note?: string): Promise<SOSRequest> {
  return fetchJSON<SOSRequest>(`/api/v1/dispatch/${sosId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ note: note || "" }),
  });
}

export async function undoDispatch(sosId: number): Promise<SOSRequest> {
  return fetchJSON<SOSRequest>(`/api/v1/dispatch/${sosId}/undo`, {
    method: "POST",
  });
}

export async function rejectSOS(sosId: number, reason: string): Promise<SOSRequest> {
  return fetchJSON<SOSRequest>(`/api/v1/sos/${sosId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function holdSOS(sosId: number, reason: string): Promise<SOSRequest> {
  return fetchJSON<SOSRequest>(`/api/v1/sos/${sosId}/hold`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function escalateSOS(
  sosId: number,
  reason: string,
  agency = "BFP",
): Promise<SOSRequest> {
  return fetchJSON<SOSRequest>(`/api/v1/sos/${sosId}/escalate`, {
    method: "POST",
    body: JSON.stringify({ reason, agency }),
  });
}

export async function addSOSNote(sosId: number, note: string): Promise<SOSRequest> {
  return fetchJSON<SOSRequest>(`/api/v1/sos/${sosId}/notes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function getSOSLog(sosId: number): Promise<IncidentLogItem[]> {
  return fetchJSON<IncidentLogItem[]>(`/api/v1/sos/${sosId}/log`);
}

export async function getReportLog(reportId: string): Promise<IncidentLogItem[]> {
  return fetchJSON<IncidentLogItem[]>(`/api/v1/reports/${reportId}/log`);
}

export async function fetchIncidentLog(incident: {
  id: string;
  reportId?: string;
  incidentType?: "sos" | "report";
}): Promise<IncidentLogItem[]> {
  try {
    if (
      incident.incidentType === "sos" ||
      incident.id.startsWith("FR-") ||
      incident.id.startsWith("SOS-")
    ) {
      const sosId = parseInt(incident.id.replace(/\D/g, ""), 10);
      if (!isNaN(sosId)) {
        return await getSOSLog(sosId);
      }
    } else if (incident.reportId) {
      return await getReportLog(incident.reportId);
    }
  } catch {
    // Fall back to empty array
  }
  return [];
}
