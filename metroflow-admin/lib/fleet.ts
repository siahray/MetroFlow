import type { Vehicle, VehicleInput } from "./dispatch";

/** Statuses a super admin can set by hand. DISPATCHED is set by the dispatch flow itself. */
export const UNIT_STATUSES = [
  { id: "AVAILABLE", label: "Available" },
  { id: "ON_SCENE", label: "On scene" },
  { id: "OUT_OF_SERVICE", label: "Out of service" },
] as const;

/** Suggestions only; the API stores any type up to 30 characters. */
export const UNIT_TYPES = [
  "Rescue boat",
  "High-clearance truck",
  "Ambulance",
  "Fire truck",
  "Patrol vehicle",
] as const;

export type UnitFormValues = {
  callSign: string;
  vehicleType: string;
  clearanceCm: string;
  status: string;
};

export type UnitFormErrors = Partial<Record<keyof UnitFormValues, string>>;

/** Quezon City Hall staging base (CR-002 vicinity; coordinates not official). */
export const UNIT_BASE_LOCATION = { lat: 14.6464, lon: 121.0503 };

export const EMPTY_UNIT_FORM: UnitFormValues = {
  callSign: "",
  vehicleType: "",
  clearanceCm: "",
  status: "AVAILABLE",
};

export function unitToForm(unit: Vehicle): UnitFormValues {
  return {
    callSign: unit.call_sign,
    vehicleType: unit.vehicle_type,
    clearanceCm: unit.clearance_cm != null ? String(unit.clearance_cm) : "",
    status: unit.status.toUpperCase(),
  };
}

/**
 * Check the form the same way the API will, so a mistake is explained next to the field
 * instead of coming back as a failed request.
 */
export function validateUnitForm(
  values: UnitFormValues,
): { ok: true; payload: VehicleInput } | { ok: false; errors: UnitFormErrors } {
  const errors: UnitFormErrors = {};
  const callSign = values.callSign.trim();
  const vehicleType = values.vehicleType.trim();

  if (!callSign) errors.callSign = "Enter a call sign.";
  else if (callSign.length > 50) errors.callSign = "Use 50 characters or fewer.";

  if (!vehicleType) errors.vehicleType = "Enter a unit type.";
  else if (vehicleType.length > 30) errors.vehicleType = "Use 30 characters or fewer.";

  const clearance = Number(values.clearanceCm);
  if (values.clearanceCm.trim() === "") errors.clearanceCm = "Enter the ground clearance in cm.";
  else if (!Number.isInteger(clearance) || clearance < 1 || clearance > 300)
    errors.clearanceCm = "Use a whole number from 1 to 300 cm.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      call_sign: callSign,
      vehicle_type: vehicleType,
      clearance_cm: clearance,
      status: values.status,
      current_location_lat: UNIT_BASE_LOCATION.lat,
      current_location_lon: UNIT_BASE_LOCATION.lon,
    },
  };
}
