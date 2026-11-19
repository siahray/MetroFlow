/**
 * CR-002 §2.1: the numbers the Operations Dashboard shows.
 *
 * Pure, so the KPI math can be tested without a browser. Every value comes from
 * rows the API returned — nothing here is estimated or defaulted.
 */

import type { SOSRequest, Vehicle } from "./dispatch";
import type { HazardZone } from "./hazards";
import { parseApiTime, type FieldReport } from "./reports";

export type OperationsSummary = {
  activeSos: number;
  unassignedSos: number;
  assignedSos: number;
  pendingReports: number;
  availableUnits: number;
  totalUnits: number;
  activeHazards: number;
  /** The five oldest SOS still waiting for a unit, oldest first. */
  waitingSos: SOSRequest[];
  /** The five oldest reports still awaiting moderation, oldest first. */
  waitingReports: FieldReport[];
};

/** How many waiting rows each dashboard table lists. */
const WAITING_LIMIT = 5;

function oldestFirst<T>(rows: T[], time: (row: T) => string | null): T[] {
  return (
    rows
      .map((row) => ({ row, at: parseApiTime(time(row)) }))
      // A row with no readable timestamp cannot claim to have been waiting.
      .filter((entry): entry is { row: T; at: Date } => entry.at !== null)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, WAITING_LIMIT)
      .map((entry) => entry.row)
  );
}

export function summarizeOperations({
  sos,
  reports,
  vehicles,
  hazards,
}: {
  sos: SOSRequest[];
  reports: FieldReport[];
  vehicles: Vehicle[];
  hazards: HazardZone[];
}): OperationsSummary {
  // A resolved incident is closed: it is history, not an open signal.
  const active = sos.filter((row) => row.status.toUpperCase() !== "RESOLVED");
  const unassigned = active.filter((row) => row.vehicle_id == null);

  return {
    activeSos: active.length,
    unassignedSos: unassigned.length,
    assignedSos: active.length - unassigned.length,
    pendingReports: reports.length,
    availableUnits: vehicles.filter(
      (row) => (row.status || "AVAILABLE").toUpperCase() === "AVAILABLE",
    ).length,
    totalUnits: vehicles.length,
    activeHazards: hazards.filter((row) => row.active !== false).length,
    waitingSos: oldestFirst(unassigned, (row) => row.created_at),
    waitingReports: oldestFirst(reports, (row) => row.submitted_at),
  };
}
