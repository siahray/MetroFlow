/**
 * Shapes the triage queue shares between the SOS feed and the UI.
 *
 * The queue itself is live: `sosToIncident` maps `GET /api/v1/sos` rows and
 * `reportToIncident` maps `GET /api/v1/reports`, so SOS signals and field reports
 * share one urgency-ordered queue. This module holds the types and the display
 * helpers, not demo data.
 */

export type QueueSource = "photo" | "sensor" | "escalated" | "other";

export type Incident = {
  id: string;
  level: string;
  urgency: number;
  reporter: string;
  reportedAt: string;
  aiConfidence: string;
  narrative: string;
  location: string;
  barangay: string;
  /** Display label: the most notable thing about this incident. */
  source: QueueSource;
  /** FSD-FR-026: the queue filters read these flags, so an incident can match several. */
  hasPhoto: boolean;
  escalated: boolean;
  sensorMismatch: boolean;
  tags: string[];
  incidentType?: "sos" | "report";

  // FSD-FR-034: Photo evidence with capture metadata and estimated submersion range
  reportId?: string;
  photo?: {
    mime: string;
    bytes: number;
    sha256?: string;
  } | null;
  exif?: {
    camera_make?: string;
    camera_model?: string;
    captured_at?: string;
    iso?: number;
    gps_latitude?: number;
    gps_longitude?: number;
  } | null;
  submersionRange?: string;

  // FSD-FR-035: Location and sensor context
  latitude?: number | null;
  longitude?: number | null;
  waterDepthCm?: number | null;
  waterTrend?: "rising" | "stable" | "receding";
  nearestUnit?: {
    callSign: string;
    type: string;
    distanceKm: number;
    etaMinutes: number;
    status: string;
  } | null;
};

export type LogEntry = {
  time: string;
  text: string;
  kind: "muted" | "action" | "note";
};

export const QUEUE_FILTERS = [
  { id: "all", label: "All" },
  { id: "photo", label: "Photo" },
  { id: "sensor", label: "Sensor Mismatch" },
  { id: "escalated", label: "Escalated" },
] as const;

export type QueueFilter = (typeof QUEUE_FILTERS)[number]["id"];

/**
 * Masks a phone number for PII protection (e.g. +63 917 555 0192 -> +63 91** *** ****)
 * Per UI/UX Design Audit & Scope Resolution.
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return "";

  // Remove non-digits
  const digits = phone.replace(/\D/g, "");

  // Handle Philippine mobile numbers: starts with 63 and 12 digits
  if (digits.startsWith("63") && digits.length === 12) {
    return `+63 ${digits.substring(2, 4)}** *** ****`;
  }

  // Handle 11-digit numbers starting with 0
  if (digits.startsWith("0") && digits.length === 11) {
    return `+63 ${digits.substring(1, 3)}** *** ****`;
  }

  // Fallback: show first 3 characters, mask the rest
  if (digits.length >= 3) {
    return `${digits.substring(0, 3)}** *** ****`;
  }

  return "+63 9** *** ****";
}

/** The label shown for an incident, in order of how much a dispatcher should care. */
export function primarySource(flags: {
  escalated: boolean;
  sensorMismatch: boolean;
  hasPhoto: boolean;
}): QueueSource {
  if (flags.escalated) return "escalated";
  if (flags.sensorMismatch) return "sensor";
  return flags.hasPhoto ? "photo" : "other";
}

/** FSD-FR-026: filters are independent flags, so counts can overlap. */
export function matchesQueueFilter(incident: Incident, filter: QueueFilter): boolean {
  switch (filter) {
    case "photo":
      return incident.hasPhoto;
    case "sensor":
      return incident.sensorMismatch;
    case "escalated":
      return incident.escalated;
    default:
      return true;
  }
}

export function countByFilter(incidents: Incident[], filter: QueueFilter): number {
  return incidents.filter((incident) => matchesQueueFilter(incident, filter)).length;
}
