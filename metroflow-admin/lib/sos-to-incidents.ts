import type { Incident } from "./incidents";
import type { SOSRequest } from "./dispatch";

export function sosToIncident(sos: SOSRequest): Incident {
  const createdAt = sos.created_at
    ? new Date(sos.created_at)
    : new Date();
  const reportedAt = createdAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const depthMatch = sos.note?.match(/(\d+)\s*cm/i);
  const depthCm = depthMatch ? parseInt(depthMatch[1], 10) : 50;
  const urgency = depthCm >= 75 ? 9.4 : depthCm >= 45 ? 7.8 : 6.2;
  const level =
    urgency >= 9
      ? "Critical Flood Level 3"
      : urgency >= 7.5
      ? "Moderate Hazard Level 2"
      : "Alert Level 1";

  return {
    id: `FR-${sos.sos_id.toString().padStart(4, "0")}`,
    level,
    urgency,
    reporter: "Citizen Report (SOS)",
    reportedAt: `${reportedAt}`,
    aiConfidence: "98.5% Verified",
    narrative: sos.note || `"SOS request at ${sos.latitude.toFixed(4)}, ${sos.longitude.toFixed(4)}"`,
    location: `Lat ${sos.latitude.toFixed(4)}, Lon ${sos.longitude.toFixed(4)}`,
    barangay: "Reported Location",
    source: "photo",
    tags: sos.vehicle_id ? ["Vehicle Assigned"] : ["New SOS"],
  };
}
