import { fetchJSON } from "./api";

/** The API keeps a dismissed incident this long, then deletes it. */
export const DISMISS_WINDOW_MS = 72 * 60 * 60 * 1000;

import type { Incident } from "./incidents";

// An SOS is shown as `FR-0006` (its sos_id); a field report carries its real uuid.
function path(incident: Incident, verb: "dismiss" | "restore"): string {
  return incident.incidentType === "report"
    ? `/api/v1/reports/${incident.reportId}/${verb}`
    : `/api/v1/sos/${Number(incident.id.replace(/\D/g, ""))}/${verb}`;
}

export async function dismissIncident(incident: Incident): Promise<void> {
  await fetchJSON(path(incident, "dismiss"), { method: "POST" });
}

export async function restoreIncident(incident: Incident): Promise<void> {
  await fetchJSON(path(incident, "restore"), { method: "POST" });
}

/** Whole hours before a dismissed incident is deleted, never below 1 while it exists. */
export function hoursUntilPurge(dismissedAt: string, now = Date.now()): number {
  // The API sends naive UTC timestamps.
  const at = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(dismissedAt) ? dismissedAt : `${dismissedAt}Z`);
  return Math.max(1, Math.ceil((at + DISMISS_WINDOW_MS - now) / 3_600_000));
}
