import { fetchBlob, fetchJSON } from "./api";

/**
 * Field reports and the moderation desk (FSD-FR-077 to FSD-FR-081).
 *
 * The API is the only source: `GET /api/v1/reports` returns the pending queue
 * already ordered by live urgency, and every decision is a POST that persists the
 * outcome and writes an audit row. Nothing here falls back to demo data — an
 * empty queue means nobody has reported anything.
 */

export type ReportStatus = "PENDING" | "VERIFIED" | "REJECTED" | "DUPLICATE";

export type ReportSource = "PHOTO" | "SENSOR" | "CALL";

export type ReportDepth = "ANKLE" | "KNEE" | "IMPASSABLE";

export type ReportPhoto = {
  mime: string;
  sha256: string;
  bytes: number;
};

/**
 * EXIF as the intake parser reports it. Every field is optional because a photo
 * may carry none, and `gps_in_pilot_area` is present only when the camera wrote
 * a position.
 */
export type ReportExif = {
  camera_make?: string;
  camera_model?: string;
  captured_at?: string;
  modified_at?: string;
  digitized_at?: string;
  iso?: number;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_in_pilot_area?: boolean;
};

export type FieldReport = {
  report_id: string;
  /** Salted hash of the reporting account, truncated by the API for display. */
  reporter_hash: string;
  source: string;
  depth_level: string;
  depth_label: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  location_plausible: boolean;
  barangay: string | null;
  narrative: string | null;
  /** Stored base score decayed by age; the queue is ordered on this. */
  urgency_score: number;
  nearby_reports: number;
  possible_duplicate_of: string | null;
  photo: ReportPhoto | null;
  exif: ReportExif | null;
  captured_at: string | null;
  submitted_at: string | null;
  duplicate_of: string | null;
  moderated_by: number | null;
  moderated_at: string | null;
  decision_reason: string | null;
  hazard_id: number | null;
  nearest_sensor?: NearestSensorReading | null;
};

export type NearestSensorReading = {
  sensor_id: string | null;
  sensor_name: string | null;
  sensor_type: string | null;
  latest_value: number | null;
  latest_unit: string | null;
  latest_recorded_at: string | null;
  distance_km: number | null;
  is_breach: boolean;
};

export async function listReports(status: ReportStatus = "PENDING"): Promise<FieldReport[]> {
  return fetchJSON<FieldReport[]>(`/api/v1/reports?status=${encodeURIComponent(status)}`);
}

export async function getReport(reportId: string): Promise<FieldReport> {
  return fetchJSON<FieldReport>(`/api/v1/reports/${reportId}`);
}

/** Evidence bytes, authenticated; the caller owns the object URL it builds. */
export async function getReportPhoto(reportId: string): Promise<Blob> {
  return fetchBlob(`/api/v1/reports/${reportId}/photo`);
}

/**
 * Verify a report and publish the hazard it evidences. The API maps the depth to
 * the hazard vocabulary and publishes in the same transaction, so there is no
 * second step for the portal to forget.
 */
export async function approveReport(reportId: string, notes?: string): Promise<FieldReport> {
  return fetchJSON<FieldReport>(`/api/v1/reports/${reportId}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes: notes?.trim() || null }),
  });
}

/**
 * Reject a report, or record it as a duplicate of another. `duplicateOf` is what
 * makes the decision DUPLICATE instead of REJECTED; both keep the reason.
 */
export async function rejectReport(
  reportId: string,
  reason: string,
  duplicateOf?: string | null,
): Promise<FieldReport> {
  return fetchJSON<FieldReport>(`/api/v1/reports/${reportId}/reject`, {
    method: "POST",
    body: JSON.stringify({
      reason: reason.trim(),
      duplicate_of: duplicateOf || null,
    }),
  });
}

export async function holdReport(reportId: string, reason: string): Promise<FieldReport> {
  return fetchJSON<FieldReport>(`/api/v1/reports/${reportId}/hold`, {
    method: "POST",
    body: JSON.stringify({ reason: reason.trim() }),
  });
}

export async function escalateReport(
  reportId: string,
  reason: string,
  agency = "BFP",
): Promise<FieldReport> {
  return fetchJSON<FieldReport>(`/api/v1/reports/${reportId}/escalate`, {
    method: "POST",
    body: JSON.stringify({ reason: reason.trim(), agency }),
  });
}

export async function addReportNote(reportId: string, note: string): Promise<FieldReport> {
  return fetchJSON<FieldReport>(`/api/v1/reports/${reportId}/notes`, {
    method: "POST",
    body: JSON.stringify({ note: note.trim() }),
  });
}

export async function getNearestSensorReading(reportId: string): Promise<NearestSensorReading> {
  return fetchJSON<NearestSensorReading>(`/api/v1/reports/${reportId}/nearest-sensor`);
}

/**
 * Parse an API timestamp as the UTC instant it is.
 *
 * The API stores naive UTC datetimes, so `new Date("2026-10-29T13:04:12")` would
 * be read as local time and a fresh report would look eight hours old in Manila.
 */
export function parseApiTime(value: string | null): Date | null {
  if (!value) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  const parsed = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** "just now", "7 min ago", "3 h ago" — the age a dispatcher reads at a glance. */
export function ageLabel(value: string | null): string {
  const time = parseApiTime(value);
  if (!time) return "time unknown";
  const seconds = Math.max(0, Math.round((Date.now() - time.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

/** A clock time in the operator's locale, or an em dash when absent. */
export function clockLabel(value: string | null): string {
  const time = parseApiTime(value);
  if (!time) return "—";
  return time.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The last eight characters are enough to tell two hashes apart in a list. */
export function shortHash(hash: string): string {
  return hash.length > 12 ? `…${hash.slice(-8)}` : hash;
}

/** A hazard name the desk recognises, used when confirming what approval published. */
export function approvalSummary(report: FieldReport): string {
  const depth = report.depth_label?.toLowerCase() || report.depth_level.toLowerCase();
  return `Reported ${depth}${report.barangay ? ` — ${report.barangay}` : ""}`;
}
