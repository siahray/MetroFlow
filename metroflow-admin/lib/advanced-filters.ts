import type { Incident } from "./incidents";

/**
 * P3-2: advanced queue filters layered on top of the quick assignment filter and
 * free-text search. On the SOS-only Dispatch Radar the only extra question left
 * is how old a signal is — barangay, source type and urgency score describe field
 * reports, which this screen no longer lists.
 */
export type AdvancedFilters = {
  /** Only incidents created within this many hours; null means any age. */
  maxAgeHours: number | null;
};

export const EMPTY_ADVANCED_FILTERS: AdvancedFilters = {
  maxAgeHours: null,
};

export function isAdvancedFilterActive(filters: AdvancedFilters): boolean {
  return filters.maxAgeHours !== null;
}

export function matchesAdvancedFilters(incident: Incident, filters: AdvancedFilters): boolean {
  if (filters.maxAgeHours !== null) {
    const created = incident.createdAt ? Date.parse(incident.createdAt) : NaN;
    if (!Number.isFinite(created)) return false;
    if ((Date.now() - created) / 3_600_000 > filters.maxAgeHours) return false;
  }
  return true;
}
