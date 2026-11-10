import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SensorManagement } from "./sensor-management";
import { ToastProvider } from "./toast-provider";
import type { Sensor } from "@/lib/sensors";

const SENSORS: Sensor[] = [
  {
    sensor_id: "RIVER-01",
    sensor_type: "RIVER_GAUGE",
    name: "Marikina River",
    latitude: 14.6,
    longitude: 121.1,
    threshold_value: 2,
    threshold_unit: "m",
    impact_radius_m: 500,
    active: true,
    simulated: false,
    last_reading_at: null,
    last_value: 1.2,
    last_flagged: false,
  },
  {
    sensor_id: "RAIN-02",
    sensor_type: "RAIN_GAUGE",
    name: "Cubao Rain Gauge",
    latitude: 14.62,
    longitude: 121.05,
    threshold_value: 30,
    threshold_unit: "mm_hr",
    impact_radius_m: 300,
    active: true,
    simulated: false,
    last_reading_at: null,
    last_value: 45,
    last_flagged: true,
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderSensors() {
  return render(
    <ToastProvider>
      <SensorManagement />
    </ToastProvider>,
  );
}

let originalFetch: typeof fetch;
let originalConfirm: typeof window.confirm;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalConfirm = window.confirm;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  window.confirm = originalConfirm;
  cleanup();
});

test("loads and lists sensors, with a breach badge on a flagged reading", async () => {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(SENSORS))) as typeof fetch;
  await act(async () => renderSensors());

  expect(await screen.findByText("Marikina River")).toBeTruthy();
  expect(screen.getByText("Cubao Rain Gauge")).toBeTruthy();
  expect(screen.getByText("BREACH")).toBeTruthy();
  expect(screen.getByText("ACTIVE")).toBeTruthy();
});

test("search narrows the list by name or id", async () => {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(SENSORS))) as typeof fetch;
  await act(async () => renderSensors());
  await screen.findByText("Marikina River");

  fireEvent.change(screen.getByPlaceholderText("Search sensors..."), {
    target: { value: "cubao" },
  });

  expect(screen.queryByText("Marikina River")).toBeNull();
  expect(screen.getByText("Cubao Rain Gauge")).toBeTruthy();
});

test("a load failure shows ErrorNotice with a working retry", async () => {
  let calls = 0;
  globalThis.fetch = (() => {
    calls++;
    return calls === 1
      ? Promise.resolve(jsonResponse({ detail: "down" }, 500))
      : Promise.resolve(jsonResponse(SENSORS));
  }) as typeof fetch;
  await act(async () => renderSensors());

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Server error");

  fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(screen.getByText("Marikina River")).toBeTruthy();
});

test("Add Sensor opens the create modal and Cancel closes it", async () => {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(SENSORS))) as typeof fetch;
  await act(async () => renderSensors());
  await screen.findByText("Marikina River");

  fireEvent.click(screen.getByRole("button", { name: /add sensor/i }));
  expect(screen.getByText("Add Sensor", { selector: "h3" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(screen.queryByText("Add Sensor", { selector: "h3" })).toBeNull();
});

test("deleting a sensor asks for confirmation and skips the call when declined", async () => {
  let deleteCalled = false;
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") {
      deleteCalled = true;
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(jsonResponse(SENSORS));
  }) as typeof fetch;
  window.confirm = (() => false) as typeof window.confirm;

  await act(async () => renderSensors());
  await screen.findByText("Marikina River");

  fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);
  expect(deleteCalled).toBe(false);
});
