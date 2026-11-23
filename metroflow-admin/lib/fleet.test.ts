import { describe, expect, test } from "bun:test";

import {
  EMPTY_UNIT_FORM,
  UNIT_BASE_LOCATION,
  unitToForm,
  validateUnitForm,
  type UnitFormValues,
} from "./fleet";
import type { Vehicle } from "./dispatch";

const valid: UnitFormValues = {
  callSign: "  RU-07 ",
  vehicleType: "Rescue boat",
  clearanceCm: "60",
  status: "AVAILABLE",
};

describe("unit form validation", () => {
  test("a complete form becomes the API payload, trimmed", () => {
    const result = validateUnitForm(valid);
    expect(result).toEqual({
      ok: true,
      payload: {
        call_sign: "RU-07",
        vehicle_type: "Rescue boat",
        clearance_cm: 60,
        status: "AVAILABLE",
        current_location_lat: UNIT_BASE_LOCATION.lat,
        current_location_lon: UNIT_BASE_LOCATION.lon,
      },
    });
  });

  test("an empty form explains each missing field", () => {
    const result = validateUnitForm(EMPTY_UNIT_FORM);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["callSign", "clearanceCm", "vehicleType"]);
    }
  });

  test("clearance must be a whole number from 1 to 300", () => {
    for (const bad of ["0", "301", "12.5", "abc", "-4"]) {
      const result = validateUnitForm({ ...valid, clearanceCm: bad });
      expect(result.ok).toBe(false);
    }
    for (const good of ["1", "300", "45"]) {
      expect(validateUnitForm({ ...valid, clearanceCm: good }).ok).toBe(true);
    }
  });

  test("units default to the base location", () => {
    const result = validateUnitForm(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.current_location_lat).toBe(UNIT_BASE_LOCATION.lat);
      expect(result.payload.current_location_lon).toBe(UNIT_BASE_LOCATION.lon);
    }
  });

  test("lengths match the API limits", () => {
    expect(validateUnitForm({ ...valid, callSign: "x".repeat(51) }).ok).toBe(false);
    expect(validateUnitForm({ ...valid, vehicleType: "x".repeat(31) }).ok).toBe(false);
  });
});

describe("editing a unit", () => {
  test("the form starts from the unit's stored values", () => {
    const unit: Vehicle = {
      vehicle_id: 3,
      call_sign: "RU-03",
      vehicle_type: "Ambulance",
      clearance_cm: 40,
      status: "out_of_service",
      current_location_lat: 14.6,
      current_location_lon: 121.01,
      speed_kmh: null,
    };
    expect(unitToForm(unit)).toEqual({
      callSign: "RU-03",
      vehicleType: "Ambulance",
      clearanceCm: "40",
      status: "OUT_OF_SERVICE",
    });
  });

  test("a unit with no clearance gives an empty clearance field, not 'null'", () => {
    const form = unitToForm({
      vehicle_id: 1,
      call_sign: "X",
      vehicle_type: "Y",
      clearance_cm: null,
      status: "AVAILABLE",
      current_location_lat: null,
      current_location_lon: null,
      speed_kmh: null,
    });
    expect(form.clearanceCm).toBe("");
  });
});
