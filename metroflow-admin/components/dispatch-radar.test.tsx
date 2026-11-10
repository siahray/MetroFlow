import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { Incident } from "@/lib/incidents";
import { DispatchRadar } from "./dispatch-radar";

const SOS_INCIDENT: Incident = {
  id: "42",
  level: "HIGH",
  urgency: null,
  createdAt: "2026-11-10T10:00:00Z",
  reporter: "Driver",
  reportedAt: "6:14 PM (GMT+8)",
  narrative: "Car stalled in deep water",
  location: "EDSA northbound",
  barangay: "Kamuning",
  source: "other",
  hasPhoto: false,
  escalated: false,
  sensorMismatch: false,
  tags: [],
  incidentType: "sos",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderRadar(incident: Incident = SOS_INCIDENT) {
  const calls: string[] = [];
  const utils = render(
    <DispatchRadar
      incident={incident}
      queueCount={3}
      onBack={() => calls.push("back")}
      onAction={(label) => calls.push(`action:${label}`)}
      onMessage={(msg) => calls.push(`message:${msg}`)}
      onOpenDispatchModal={() => calls.push("dispatch-modal")}
    />,
  );
  return { calls, ...utils };
}

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  cleanup();
});

test("renders the SOS details: location, reporter, narrative and priority", () => {
  renderRadar();

  expect(screen.getByText(/Dispatch Radar #42/)).toBeTruthy();
  expect(screen.getAllByText("EDSA northbound").length).toBeGreaterThan(0);
  expect(screen.getByText(/Kamuning · reported/)).toBeTruthy();
  expect(screen.getAllByText("6:14 PM (GMT+8)").length).toBeGreaterThan(0);
  expect(screen.getByText(/Car stalled in deep water/)).toBeTruthy();
  expect(screen.getAllByText("SOS").length).toBeGreaterThan(0);
});

test("Approve & Dispatch opens the dispatch modal and Back fires onBack", () => {
  const { calls } = renderRadar();

  fireEvent.click(screen.getByRole("button", { name: /Approve & Dispatch/ }));
  fireEvent.click(screen.getByRole("button", { name: "Back" }));

  expect(calls).toEqual(["dispatch-modal", "back"]);
});

test("a dispatched incident locks reject/escalate and shows the Dispatched badge", () => {
  renderRadar({ ...SOS_INCIDENT, tags: ["Vehicle Assigned", "Dispatched"] });

  expect(screen.getByText("Dispatched")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: /Reject \/ False Alarm/ }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: /Escalate \(BFP\)/ }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

test("Add Note saves through the API and confirms via onMessage", async () => {
  const requests: { url: string; body: unknown }[] = [];
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    return Promise.resolve(jsonResponse({}));
  }) as typeof fetch;

  const { calls } = renderRadar();
  fireEvent.click(screen.getByRole("button", { name: /Add Note/ }));
  fireEvent.change(screen.getByLabelText("Add Operational Triage Note"), {
    target: { value: "Unit 7 confirmed water at axle height" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Note" }));

  await waitFor(() => expect(calls).toContain("message:Internal note saved to incident log"));
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toContain("/api/v1/sos/42/notes");
  expect(requests[0].body).toEqual({ note: "Unit 7 confirmed water at axle height" });
});

test("a failed note save reports the failure, not success", async () => {
  globalThis.fetch = (() => Promise.resolve(jsonResponse({ detail: "nope" }, 500))) as typeof fetch;
  const { calls } = renderRadar();

  fireEvent.click(screen.getByRole("button", { name: /Add Note/ }));
  fireEvent.change(screen.getByLabelText("Add Operational Triage Note"), {
    target: { value: "test note" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save Note" }));
  });

  await waitFor(() =>
    expect(calls).toContain("message:Note could not be saved. Check the connection and try again."),
  );
});

test("reject requires a reason of 3+ characters, then posts to /reject", async () => {
  const requests: { url: string; body: unknown }[] = [];
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    return Promise.resolve(jsonResponse({}));
  }) as typeof fetch;

  const { calls } = renderRadar();
  fireEvent.click(screen.getByRole("button", { name: /Reject \/ False Alarm/ }));

  const confirm = screen.getByRole("button", { name: "Confirm Action" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText(/Mandatory Operational Reason/), {
    target: { value: "Duplicate of report 7" },
  });
  expect(confirm.disabled).toBe(false);

  await act(async () => {
    fireEvent.click(confirm);
  });

  await waitFor(() =>
    expect(calls).toContain("action:Rejected as False Alarm: Duplicate of report 7"),
  );
  expect(requests[0].url).toContain("/api/v1/sos/42/reject");
  expect(requests[0].body).toEqual({ reason: "Duplicate of report 7" });
});

test("escalate posts the chosen agency and reason", async () => {
  const requests: { url: string; body: unknown }[] = [];
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    return Promise.resolve(jsonResponse({}));
  }) as typeof fetch;

  const { calls } = renderRadar();
  fireEvent.click(screen.getByRole("button", { name: /Escalate \(BFP\)/ }));

  fireEvent.change(screen.getByLabelText("Target Escalation Agency"), {
    target: { value: "Coast Guard" },
  });
  fireEvent.change(screen.getByLabelText(/Mandatory Operational Reason/), {
    target: { value: "Vehicle in moving water" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm Action" }));
  });

  await waitFor(() =>
    expect(calls).toContain("action:Escalated to Coast Guard: Vehicle in moving water"),
  );
  expect(requests[0].url).toContain("/api/v1/sos/42/escalate");
  expect(requests[0].body).toEqual({ reason: "Vehicle in moving water", agency: "Coast Guard" });
});

test("an API failure surfaces as an action error, not a silent close", async () => {
  globalThis.fetch = (() =>
    Promise.resolve(jsonResponse({ detail: "conflict" }, 409))) as typeof fetch;
  const { calls } = renderRadar();

  fireEvent.click(screen.getByRole("button", { name: /Reject \/ False Alarm/ }));
  fireEvent.change(screen.getByLabelText(/Mandatory Operational Reason/), {
    target: { value: "bad data" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm Action" }));
  });

  await waitFor(() => expect(calls.some((c) => c.startsWith("action:Action error:"))).toBe(true));
});
