/**
 * Rescue fleet and dispatch tracking data.
 * Units: clearance in cm, speed in km/h, distance in km.
 * Aligns with FSD.md and UI/UX Design Audit & Scope Resolution.
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
  return (RESCUE_UNIT_STATUSES as readonly string[]).includes(upper)
    ? (upper as RescueUnit["status"])
    : "AVAILABLE";
}

export type DistressBeacon = {
  incidentId: string;
  barangay: string;
  coordinates: string;
  note: string;
  photoTime: string;
  depth_cm: number;
};

export type MissionMilestone = {
  state: "done" | "current" | "pending";
  label: string;
  time: string;
  detail: string;
};

export const RESCUE_UNITS: RescueUnit[] = [
  {
    callSign: "RU-03",
    type: "Inflatable Rescue Boat",
    status: "EN_ROUTE",
    clearance_cm: 35,
    speed_kmh: 24,
    location: "Pasig River Corridor",
    eta_min: 12,
  },
  {
    callSign: "RU-01",
    type: "High-Clearance 4x4 Truck",
    status: "AVAILABLE",
    clearance_cm: 45,
    speed_kmh: 60,
    location: "Depot Delta HQ",
  },
  {
    callSign: "RU-04",
    type: "Rapid Extraction Vehicle",
    status: "ON_SCENE",
    clearance_cm: 50,
    speed_kmh: 0,
    location: "Malaya Overpass",
  },
];

export const RESCUE_UNIT = RESCUE_UNITS[0];

export const DISTRESS_BEACON: DistressBeacon = {
  incidentId: "FR-0248",
  barangay: "Brgy. San Pedro",
  coordinates: "14.5995° N, 121.0223° E",
  note: "SOS note: 6 civilians trapped on stair landing. Water level approx 75 cm inside premises and rising.",
  photoTime: "11:52 AM",
  depth_cm: 75,
};

export const MISSION_MILESTONES: MissionMilestone[] = [
  {
    state: "done",
    label: "Step 1: Dispatched",
    time: "11:58 AM",
    detail: "Depot Delta Station",
  },
  {
    state: "current",
    label: "Step 2: En Route",
    time: "12:01 PM",
    detail: "Flood-safe corridor active (24 km/h)",
  },
  {
    state: "pending",
    label: "Step 3: On Scene",
    time: "Est. 12:13 PM",
    detail: "Target perimeter (San Pedro)",
  },
];
