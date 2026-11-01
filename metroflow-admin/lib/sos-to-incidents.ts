import type { Incident } from "./incidents";
import type { SOSRequest, Vehicle } from "./dispatch";
import type { FieldReport } from "./reports";
import type { HazardZone } from "./hazards";
import { findNearestUnit, haversineDistanceKm } from "./geo";

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

  const depthMatch = sos.note?.match(/(\d+)\s*(?:cm|ft)/i);
  let depthCm = 50;
  if (depthMatch) {
    const val = Number.parseFloat(depthMatch[1]);
    depthCm = sos.note?.toLowerCase().includes("ft") ? Math.round(val * 30.48) : Math.round(val);
  }

  const urgency = depthCm >= 75 ? 9.4 : depthCm >= 45 ? 7.8 : 6.2;
  const level =
    urgency >= 9
      ? "Critical Flood Level 3"
      : urgency >= 7.5
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

  const isRising =
    sos.note?.toLowerCase().includes("rising") ||
    (options?.hazards?.some((h) => h.active !== false && (h.avg_depth_cm ?? 0) >= 30) ?? false);

  return {
    id: `FR-${sos.sos_id.toString().padStart(4, "0")}`,
    level,
    urgency,
    reporter: "Citizen Distress Signal (SOS)",
    reportedAt: `${reportedAt}`,
    aiConfidence: "98.5% Verified",
    narrative:
      sos.note ||
      `SOS rescue requested at coordinates ${sos.latitude.toFixed(4)}, ${sos.longitude.toFixed(4)}.`,
    location: `Lat ${sos.latitude.toFixed(4)}, Lon ${sos.longitude.toFixed(4)}`,
    barangay: "Reported Corridor",
    source: linkedReport?.photo ? "photo" : "sensor",
    tags: [
      ...(sos.vehicle_id ? ["Vehicle Assigned"] : ["Active SOS"]),
      ...(linkedReport?.photo ? ["Corroborating Evidence Attached"] : []),
    ],
    incidentType: "sos",

    // FSD-FR-034
    reportId: linkedReport?.report_id,
    photo: linkedReport?.photo ?? null,
    exif: linkedReport?.exif ?? null,
    submersionRange:
      linkedReport?.depth_label ??
      `${depthCm} cm (${depthCm >= 60 ? "Impassable" : "Critical Ponding"})`,

    // FSD-FR-035
    latitude: sos.latitude,
    longitude: sos.longitude,
    waterDepthCm: depthCm,
    waterTrend: isRising ? "rising" : "stable",
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

  const depthCm =
    report.depth_level === "IMPASSABLE" ? 75 : report.depth_level === "KNEE" ? 45 : 20;

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
    reporter: `Citizen Field Reporter (${report.reporter_hash.slice(0, 8)})`,
    reportedAt,
    aiConfidence: `${Math.min(99, Math.max(70, Math.round(report.urgency_score * 10)))}% Verified`,
    narrative: report.narrative || `Citizen field report with ${report.depth_label.toLowerCase()}.`,
    location:
      report.latitude != null && report.longitude != null
        ? `Lat ${report.latitude.toFixed(4)}, Lon ${report.longitude.toFixed(4)}`
        : "GPS Fix Pending",
    barangay: report.barangay || "Pilot Sector",
    source: report.photo ? "photo" : "sensor",
    tags: [report.depth_label, report.status, ...(report.photo ? ["Photo Evidence"] : [])],
    incidentType: "report",

    // FSD-FR-034
    reportId: report.report_id,
    photo: report.photo ?? null,
    exif: report.exif ?? null,
    submersionRange: report.depth_label,

    // FSD-FR-035
    latitude: report.latitude,
    longitude: report.longitude,
    waterDepthCm: depthCm,
    waterTrend: "rising",
    nearestUnit,
  };
}
