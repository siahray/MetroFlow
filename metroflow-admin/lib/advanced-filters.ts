import type { Incident } from "./incidents";

/**
 * P3-2: advanced queue filters layered on top of the quick source filter and
 * free-text search. Every field is optional; an empty filter matches nothing
 * extra, so the defaults reproduce the unfiltered queue.
 */
export type AdvancedFilters = {
  /** Exact barangay name; "" means any. */
  barangay: string;
  /** Incident origin; "all" means SOS signals and field reports. */
  type: "all" | "sos" | "report";
  /** Only incidents created within this many hours; null means any age. */
  maxAgeHours: number | null;
  /** Minimum urgency score; SOS signals carry no score and only match when null. */
  minUrgency: number | null;
};

export const EMPTY_ADVANCED_FILTERS: AdvancedFilters = {
  barangay: "",
  type: "all",
  maxAgeHours: null,
  minUrgency: null,
};

export function isAdvancedFilterActive(filters: AdvancedFilters): boolean {
  return (
    filters.barangay !== "" ||
    filters.type !== "all" ||
    filters.maxAgeHours !== null ||
    filters.minUrgency !== null
  );
}

export function matchesAdvancedFilters(incident: Incident, filters: AdvancedFilters): boolean {
  if (filters.barangay !== "" && incident.barangay !== filters.barangay) {
    return false;
  }
  if (filters.type !== "all" && incident.incidentType !== filters.type) {
    return false;
  }
  if (filters.maxAgeHours !== null) {
    const created = incident.createdAt ? Date.parse(incident.createdAt) : NaN;
    if (!Number.isFinite(created)) return false;
    if ((Date.now() - created) / 3_600_000 > filters.maxAgeHours) return false;
  }
  if (filters.minUrgency !== null) {
    // SOS rows have no score; a urgency floor can only be met by scored reports.
    if (incident.urgency === null || incident.urgency < filters.minUrgency) {
      return false;
    }
  }
  return true;
}
