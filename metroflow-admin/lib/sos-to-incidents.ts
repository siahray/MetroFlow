import { primarySource, type Incident } from "./incidents";
import type { SOSRequest, Vehicle } from "./dispatch";
import type { FieldReport } from "./reports";
import type { HazardZone } from "./hazards";
import { findNearestUnit, haversineDistanceKm } from "./geo";

/** The API records an escalation in the report's decision reason (the report stays pending). */
export function isEscalatedReport(report: FieldReport): boolean {
  return report.decision_reason?.startsWith("Escalated to") ?? false;
}

export function sosToIncident(
  sos: SOSRequest,
  options?: {
    reports?: FieldReport[];
    vehicles?: Vehicle[];
    hazards?: HazardZone[];
  },
): Incident {
  const createdAt = sos.created_at ? new Date(sos.created_at) : new Date();
  const reportedAt = createdAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // The depth is only known if the person wrote it in the note; never assume one.
  const depthMatch = sos.note?.match(/(\d+)\s*(?:cm|ft)/i);
  let depthCm: number | null = null;
  if (depthMatch) {
    const val = Number.parseFloat(depthMatch[1]);
    depthCm = sos.note?.toLowerCase().includes("ft") ? Math.round(val * 30.48) : Math.round(val);
  }

  // Describes only what the person reported; it does not rank the incident.
  const level =
    depthCm === null
      ? "Distress signal (depth not reported)"
      : depthCm >= 75
        ? "Critical Flood Level 3"
        : depthCm >= 45
          ? "Moderate Hazard Level 2"
          : "Alert Level 1";

  // Check for nearby field report evidence (within 1.5 km)
  let linkedReport: FieldReport | null = null;
  if (options?.reports && options.reports.length > 0) {
    for (const r of options.reports) {
      if (r.latitude != null && r.longitude != null) {
        const d = haversineDistanceKm(sos.latitude, sos.longitude, r.latitude, r.longitude);
        if (d <= 1.5) {
          linkedReport = r;
          break;
        }
      }
    }
  }

  // Calculate nearest unit
  const nearestUnit =
    options?.vehicles && options.vehicles.length > 0
      ? findNearestUnit(sos.latitude, sos.longitude, options.vehicles)
      : null;

  return {
    id: `FR-${sos.sos_id.toString().padStart(4, "0")}`,
    level,
    urgency: null,
    createdAt: sos.created_at ?? null,
    reporter: "Citizen Distress Signal (SOS)",
    reportedAt: `${reportedAt}`,
    narrative: sos.note ?? "",
    location: `Lat ${sos.latitude.toFixed(4)}, Lon ${sos.longitude.toFixed(4)}`,
    barangay: "Barangay not given",
    source: primarySource({
      escalated: sos.status === "escalated",
      sensorMismatch: linkedReport?.sensor_mismatch ?? false,
      hasPhoto: Boolean(linkedReport?.photo),
    }),
    hasPhoto: Boolean(linkedReport?.photo),
    escalated: sos.status === "escalated",
    sensorMismatch: linkedReport?.sensor_mismatch ?? false,
    tags: [
      ...(sos.status === "escalated" ? ["Escalated"] : []),
      ...(sos.vehicle_id ? ["Vehicle Assigned"] : ["Active SOS"]),
      ...(linkedReport?.photo ? ["Corroborating Evidence Attached"] : []),
    ],
    incidentType: "sos",

    // FSD-FR-034
    reportId: linkedReport?.report_id,
    photo: linkedReport?.photo ?? null,
    exif: linkedReport?.exif ?? null,
    submersionRange:
      linkedReport?.depth_label ?? (depthCm === null ? "Depth not reported" : `${depthCm} cm`),

    // FSD-FR-035
    latitude: sos.latitude,
    longitude: sos.longitude,
    waterDepthCm: depthCm,
    nearestUnit,
  };
}

export function reportToIncident(
  report: FieldReport,
  options?: {
    vehicles?: Vehicle[];
    hazards?: HazardZone[];
  },
): Incident {
  const createdAt =
    report.submitted_at || report.captured_at
      ? new Date(report.submitted_at || report.captured_at!)
      : new Date();

  const reportedAt = createdAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const level =
    report.depth_level === "IMPASSABLE"
      ? "Critical Flood Level 3"
      : report.depth_level === "KNEE"
        ? "Moderate Hazard Level 2"
        : "Alert Level 1";

  const nearestUnit =
    report.latitude != null &&
    report.longitude != null &&
    options?.vehicles &&
    options.vehicles.length > 0
      ? findNearestUnit(report.latitude, report.longitude, options.vehicles)
      : null;

  return {
    id: `REP-${report.report_id.slice(0, 8)}`,
    level,
    urgency: report.urgency_score,
    createdAt: report.submitted_at ?? report.captured_at ?? null,
    reporter: `Citizen Field Reporter (${report.reporter_hash.slice(0, 8)})`,
    reportedAt,
    narrative: report.narrative ?? "",
    location:
      report.latitude != null && report.longitude != null
        ? `Lat ${report.latitude.toFixed(4)}, Lon ${report.longitude.toFixed(4)}`
        : "GPS Fix Pending",
    barangay: report.barangay || "Barangay not given",
    source: primarySource({
      escalated: isEscalatedReport(report),
      sensorMismatch: report.sensor_mismatch ?? false,
      hasPhoto: Boolean(report.photo),
    }),
    hasPhoto: Boolean(report.photo),
    escalated: isEscalatedReport(report),
    sensorMismatch: report.sensor_mismatch ?? false,
    tags: [
      report.depth_label,
      report.status,
      ...(isEscalatedReport(report) ? ["Escalated"] : []),
      ...(report.sensor_mismatch ? ["Gauge disagrees"] : []),
      ...(report.photo ? ["Photo Evidence"] : []),
    ],
    incidentType: "report",

    // FSD-FR-034
    reportId: report.report_id,
    photo: report.photo ?? null,
    exif: report.exif ?? null,
    submersionRange: report.depth_label,

    // FSD-FR-035
    latitude: report.latitude,
    longitude: report.longitude,
    // The report gives a depth band (the label), not a measurement.
    waterDepthCm: null,
    nearestUnit,
  };
}
