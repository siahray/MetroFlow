import { describe, expect, test } from "bun:test";

import { EMPTY_UNIT_FORM, unitToForm, validateUnitForm, type UnitFormValues } from "./fleet";
import type { Vehicle } from "./dispatch";

const valid: UnitFormValues = {
  callSign: "  RU-07 ",
  vehicleType: "Rescue boat",
  clearanceCm: "60",
  status: "AVAILABLE",
  latitude: "",
  longitude: "",
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

  test("a position needs both coordinates, inside range", () => {
    const onlyLat = validateUnitForm({ ...valid, latitude: "14.6" });
    expect(onlyLat.ok).toBe(false);
    if (!onlyLat.ok) expect(onlyLat.errors.longitude).toBeDefined();

    expect(validateUnitForm({ ...valid, latitude: "91", longitude: "121" }).ok).toBe(false);
    const both = validateUnitForm({ ...valid, latitude: "14.585", longitude: "121.056" });
    expect(both.ok).toBe(true);
    if (both.ok) {
      expect(both.payload.current_location_lat).toBe(14.585);
      expect(both.payload.current_location_lon).toBe(121.056);
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
      latitude: "14.6",
      longitude: "121.01",
    });
  });

  test("a unit with no position and no clearance gives empty fields, not 'null'", () => {
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
    expect([form.clearanceCm, form.latitude, form.longitude]).toEqual(["", "", ""]);
  });
});
