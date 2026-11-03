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
  latitude: string;
  longitude: string;
};

export type UnitFormErrors = Partial<Record<keyof UnitFormValues, string>>;

export const EMPTY_UNIT_FORM: UnitFormValues = {
  callSign: "",
  vehicleType: "",
  clearanceCm: "",
  status: "AVAILABLE",
  latitude: "",
  longitude: "",
};

export function unitToForm(unit: Vehicle): UnitFormValues {
  return {
    callSign: unit.call_sign,
    vehicleType: unit.vehicle_type,
    clearanceCm: unit.clearance_cm != null ? String(unit.clearance_cm) : "",
    status: unit.status.toUpperCase(),
    latitude: unit.current_location_lat != null ? String(unit.current_location_lat) : "",
    longitude: unit.current_location_lon != null ? String(unit.current_location_lon) : "",
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

  const hasLat = values.latitude.trim() !== "";
  const hasLon = values.longitude.trim() !== "";
  const lat = Number(values.latitude);
  const lon = Number(values.longitude);
  if (hasLat !== hasLon) {
    errors[hasLat ? "longitude" : "latitude"] = "Give both latitude and longitude, or neither.";
  } else if (hasLat && hasLon) {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.latitude = "Latitude is -90 to 90.";
    if (!Number.isFinite(lon) || lon < -180 || lon > 180)
      errors.longitude = "Longitude is -180 to 180.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      call_sign: callSign,
      vehicle_type: vehicleType,
      clearance_cm: clearance,
      status: values.status,
      ...(hasLat && hasLon ? { current_location_lat: lat, current_location_lon: lon } : {}),
    },
  };
}
