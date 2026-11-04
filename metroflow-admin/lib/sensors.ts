import { fetchJSON } from "./api";

export type Sensor = {
  sensor_id: string;
  sensor_type: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  threshold_value: number;
  threshold_unit: "m" | "mm_hr";
  impact_radius_m: number;
  active: boolean;
  simulated: boolean;
  last_reading_at: string | null;
  last_value: number | null;
  last_flagged: boolean | null;
};

/** Suggestions only; the API stores any type. */
export const SENSOR_TYPES = ["RIVER_GAUGE", "RAIN_GAUGE"] as const;

export async function listSensors(activeOnly = false): Promise<Sensor[]> {
  return fetchJSON<Sensor[]>(`/api/v1/sensors?active_only=${activeOnly}`);
}

export type SensorInput = {
  sensor_id: string;
  sensor_type: string;
  name: string;
  latitude: number;
  longitude: number;
  threshold_value: number;
  threshold_unit: "m" | "mm_hr";
  impact_radius_m: number;
  simulated?: boolean;
};

export async function createSensor(data: SensorInput): Promise<Sensor> {
  return fetchJSON<Sensor>("/api/v1/sensors", { method: "POST", body: JSON.stringify(data) });
}

export async function updateSensor(
  sensorId: string,
  data: Partial<
    Pick<
      SensorInput,
      | "name"
      | "latitude"
      | "longitude"
      | "threshold_value"
      | "threshold_unit"
      | "impact_radius_m"
      | "simulated"
    > & { active: boolean }
  >,
): Promise<Sensor> {
  return fetchJSON<Sensor>(`/api/v1/sensors/${sensorId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSensor(sensorId: string): Promise<void> {
  await fetchJSON<void>(`/api/v1/sensors/${sensorId}`, { method: "DELETE" });
}

// --- Form validation --------------------------------------------------------

export type SensorFormValues = {
  sensorId: string;
  sensorType: string;
  name: string;
  latitude: string;
  longitude: string;
  thresholdValue: string;
  thresholdUnit: "m" | "mm_hr";
  impactRadiusM: string;
};

export type SensorFormErrors = Partial<Record<keyof SensorFormValues, string>>;

export const EMPTY_SENSOR_FORM: SensorFormValues = {
  sensorId: "",
  sensorType: "RIVER_GAUGE",
  name: "",
  latitude: "",
  longitude: "",
  thresholdValue: "",
  thresholdUnit: "m",
  impactRadiusM: "150",
};

export function sensorToForm(sensor: Sensor): SensorFormValues {
  return {
    sensorId: sensor.sensor_id,
    sensorType: sensor.sensor_type,
    name: sensor.name,
    latitude: sensor.latitude != null ? String(sensor.latitude) : "",
    longitude: sensor.longitude != null ? String(sensor.longitude) : "",
    thresholdValue: String(sensor.threshold_value),
    thresholdUnit: sensor.threshold_unit,
    impactRadiusM: String(sensor.impact_radius_m),
  };
}

/**
 * Check the form the same way the API will, so a mistake is explained next to the field
 * instead of coming back as a failed request.
 */
export function validateSensorForm(
  values: SensorFormValues,
): { ok: true; payload: SensorInput } | { ok: false; errors: SensorFormErrors } {
  const errors: SensorFormErrors = {};
  const sensorId = values.sensorId.trim();
  const name = values.name.trim();

  if (!sensorId) errors.sensorId = "Enter a sensor id.";
  else if (sensorId.length > 60) errors.sensorId = "Use 60 characters or fewer.";

  if (!name) errors.name = "Enter a name.";

  const lat = Number(values.latitude);
  if (values.latitude.trim() === "" || !Number.isFinite(lat) || lat < -90 || lat > 90)
    errors.latitude = "Latitude is -90 to 90.";

  const lon = Number(values.longitude);
  if (values.longitude.trim() === "" || !Number.isFinite(lon) || lon < -180 || lon > 180)
    errors.longitude = "Longitude is -180 to 180.";

  const threshold = Number(values.thresholdValue);
  if (values.thresholdValue.trim() === "" || !Number.isFinite(threshold) || threshold <= 0)
    errors.thresholdValue = "Enter a breach threshold greater than 0.";

  const radius = Number(values.impactRadiusM);
  if (values.impactRadiusM.trim() === "" || !Number.isFinite(radius) || radius <= 0)
    errors.impactRadiusM = "Enter an impact radius greater than 0.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      sensor_id: sensorId,
      sensor_type: values.sensorType,
      name,
      latitude: lat,
      longitude: lon,
      threshold_value: threshold,
      threshold_unit: values.thresholdUnit,
      impact_radius_m: radius,
    },
  };
}
