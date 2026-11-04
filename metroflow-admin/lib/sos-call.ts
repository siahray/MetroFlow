import { fetchJSON } from "./api";
import type { SOSRequest } from "./dispatch";

/**
 * A dispatcher logs a distress signal taken by telephone (FSD-FR-087).
 *
 * The driver app and the portal post to the same endpoint, so a call-in incident
 * arrives on the map and in the queue exactly like an app SOS.
 */
export type CallInForm = {
  latitude: string;
  longitude: string;
  note: string;
};

/** Map centre of the pilot area: only edit what the caller actually reports. */
export const CALL_IN_DEFAULT: CallInForm = {
  latitude: "14.565",
  longitude: "121.064",
  note: "",
};

export type CallInPayload = { latitude: number; longitude: number; note: string | null };

export function parseCallIn(
  form: CallInForm,
): { ok: true; payload: CallInPayload } | { ok: false; error: string } {
  const latitudeText = form.latitude.trim();
  const longitudeText = form.longitude.trim();
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  // An empty field must not become 0, which is a valid coordinate (Null Island).
  if (!latitudeText || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, error: "Latitude must be a number between -90 and 90." };
  }
  if (!longitudeText || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: "Longitude must be a number between -180 and 180." };
  }
  const note = form.note.trim();
  return { ok: true, payload: { latitude, longitude, note: note || null } };
}

export function createSOS(payload: CallInPayload): Promise<SOSRequest> {
  return fetchJSON<SOSRequest>("/api/v1/sos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
