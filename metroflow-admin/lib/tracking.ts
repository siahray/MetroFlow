/**
 * CR-002 §2.3: reading a responder's live position.
 *
 * The driver/responder client posts position batches to
 * `POST /api/v1/vehicles/{id}/telemetry`, which stamps `updated_at`; the portal
 * reads the row through the vehicles SSE feed. This module turns those rows into
 * the one thing an operator needs to know: is this fix live, stale or gone?
 */

import type { SOSRequest, Vehicle } from "./dispatch";
import { haversineDistanceKm } from "./geo";
import { parseApiTime } from "./reports";

export type FixState = "live" | "stale" | "offline" | "unknown";

/** The operator-facing word for each fix state, shared by every tracking panel. */
export const FIX_LABEL: Record<FixState, string> = {
  live: "Live",
  stale: "Stale fix",
  offline: "Offline",
  unknown: "No fix",
};

/** A fix younger than this is live; older than STALE_MS and the unit is treated as offline. */
const LIVE_MS = 60_000;
const STALE_MS = 5 * 60_000;

export function fixState(updatedAt: string | null | undefined, now = Date.now()): FixState {
  const at = parseApiTime(updatedAt ?? null);
  if (!at) return "unknown";
  const age = now - at.getTime();
  if (age <= LIVE_MS) return "live";
  if (age <= STALE_MS) return "stale";
  return "offline";
}

export type ResponderTrack = {
  unit: Vehicle;
  fix: FixState;
  /** Straight-line distance to the incident, null until the unit reports a position. */
  distanceKm: number | null;
  etaMinutes: number | null;
  updatedAt: string | null;
};

/** The unit committed to this SOS, measured against the incident it is answering. */
export function responderTrack(
  sos: SOSRequest,
  vehicles: Vehicle[],
  now = Date.now(),
): ResponderTrack | null {
  if (sos.vehicle_id == null) return null;
  const unit = vehicles.find((row) => row.vehicle_id === sos.vehicle_id);
  if (!unit) return null;

  const hasFix = unit.current_location_lat != null && unit.current_location_lon != null;
  const distanceKm = hasFix
    ? haversineDistanceKm(
        unit.current_location_lat as number,
        unit.current_location_lon as number,
        sos.latitude,
        sos.longitude,
      )
    : null;

  // shortcut: a unit that has not reported speed is assumed at 30 km/h, the same
  // assumption `findNearestUnit` makes, until the fleet reports speed.
  const speed = unit.speed_kmh && unit.speed_kmh > 5 ? unit.speed_kmh : 30;

  return {
    unit,
    fix: fixState(unit.updated_at, now),
    distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
    etaMinutes: distanceKm === null ? null : Math.max(1, Math.round((distanceKm / speed) * 60)),
    updatedAt: unit.updated_at ?? null,
  };
}
