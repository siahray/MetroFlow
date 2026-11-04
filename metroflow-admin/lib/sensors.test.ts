import { describe, expect, test } from "bun:test";

import { EMPTY_SENSOR_FORM, validateSensorForm, type SensorFormValues } from "./sensors";

const valid: SensorFormValues = {
  sensorId: "  RIVER-01 ",
  sensorType: "RIVER_GAUGE",
  name: "Marikina River Gauge",
  latitude: "14.6",
  longitude: "121.1",
  thresholdValue: "1.5",
  thresholdUnit: "m",
  impactRadiusM: "150",
};

describe("sensor form validation", () => {
  test("a complete form becomes the API payload, trimmed", () => {
    const result = validateSensorForm(valid);
    expect(result).toEqual({
      ok: true,
      payload: {
        sensor_id: "RIVER-01",
        sensor_type: "RIVER_GAUGE",
        name: "Marikina River Gauge",
        latitude: 14.6,
        longitude: 121.1,
        threshold_value: 1.5,
        threshold_unit: "m",
        impact_radius_m: 150,
      },
    });
  });

  test("an empty form reports every required field", () => {
    // impactRadiusM has a sane non-empty default (150), so it is not expected here.
    const result = validateSensorForm(EMPTY_SENSOR_FORM);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        "latitude",
        "longitude",
        "name",
        "sensorId",
        "thresholdValue",
      ]);
    }
  });

  test("latitude out of range is rejected", () => {
    const result = validateSensorForm({ ...valid, latitude: "200" });
    expect(result).toEqual({ ok: false, errors: { latitude: "Latitude is -90 to 90." } });
  });

  test("a non-positive threshold is rejected", () => {
    const result = validateSensorForm({ ...valid, thresholdValue: "0" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.thresholdValue).toBeDefined();
  });
});
