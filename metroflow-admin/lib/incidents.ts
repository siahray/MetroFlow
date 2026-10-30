/**
 * Shapes the triage queue shares between the SOS feed and the UI.
 *
 * The queue itself is live: `sosToIncident` maps `GET /api/v1/sos` rows, and
 * field reports are moderated on `/moderation` from `GET /api/v1/reports`. This
 * module holds the types and the display helpers, not demo data.
 */

export type QueueSource = "photo" | "sensor" | "escalated";

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
  source: QueueSource;
  tags: string[];
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

export function countBySource(incidents: Incident[], source: QueueSource) {
  return incidents.filter((incident) => incident.source === source).length;
}
