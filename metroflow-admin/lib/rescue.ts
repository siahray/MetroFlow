/**
 * Rescue fleet types and the status mapping. Units: clearance in cm, speed in km/h, distance in km.
 * Every value shown comes from the fleet API; nothing here is sample data.
 */

export type RescueUnit = {
  callSign: string;
  type: string;
  status: "AVAILABLE" | "EN_ROUTE" | "ON_SCENE" | "OFFLINE";
  clearance_cm: number;
  speed_kmh: number;
  location: string;
  eta_min?: number;
  /** Backend vehicle id, present once the fleet is loaded from the API. */
  vehicleId?: number;
};

/** A unit loaded from the fleet API, carrying the dispatch it is assigned to. */
export type FleetUnit = RescueUnit & { assignedSosId?: number };

export const RESCUE_UNIT_STATUSES = ["AVAILABLE", "EN_ROUTE", "ON_SCENE", "OFFLINE"] as const;

/**
 * The API stores status as free text. Anything unrecognised becomes AVAILABLE so
 * the UI never renders an empty badge.
 */
export function toUnitStatus(value: string | null | undefined): RescueUnit["status"] {
  const upper = String(value ?? "").toUpperCase();
  // FSD-BRULE-011: the API marks an assigned unit DISPATCHED; the fleet screen
  // shows that as en route, and OUT_OF_SERVICE as the offline badge.
  if (upper === "DISPATCHED") return "EN_ROUTE";
  if (upper === "OUT_OF_SERVICE") return "OFFLINE";
  return (RESCUE_UNIT_STATUSES as readonly string[]).includes(upper)
    ? (upper as RescueUnit["status"])
    : "AVAILABLE";
}
