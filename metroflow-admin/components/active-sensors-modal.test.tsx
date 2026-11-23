import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { Sensor } from "@/lib/sensors";
import { ActiveSensorsModal } from "./active-sensors-modal";

const sensor: Sensor = {
  sensor_id: "RG-01",
  sensor_type: "RAIN_GAUGE",
  name: "Rain gauge 1",
  latitude: 14.6,
  longitude: 121.0,
  threshold_value: 5,
  threshold_unit: "mm_hr",
  impact_radius_m: 100,
  active: true,
  simulated: false,
  last_reading_at: "2026-11-23T08:00:00Z",
  last_value: 8,
  last_flagged: true,
};

afterEach(() => {
  cleanup();
});

test("shows the read-only sensor table and closes on request", () => {
  let closed = false;
  render(<ActiveSensorsModal sensors={[sensor]} onClose={() => (closed = true)} />);

  expect(screen.getByRole("dialog", { name: "Active sensors" })).toBeTruthy();
  expect(screen.getByText("RG-01")).toBeTruthy();
  expect(screen.getByText("8 mm/hr")).toBeTruthy();
  expect(screen.getByText("BREACH")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(closed).toBe(true);
});

test("shows an empty state when no sensors are active", () => {
  render(<ActiveSensorsModal sensors={[]} onClose={() => {}} />);
  expect(screen.getByText("No active sensors.")).toBeTruthy();
});
