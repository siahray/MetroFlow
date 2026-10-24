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

export async function listVehicles(): Promise<Vehicle[]> {
  return fetchJSON<Vehicle[]>("/api/v1/vehicles");
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
