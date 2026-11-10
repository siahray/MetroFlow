import { afterEach, beforeEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { EMPTY_ADVANCED_FILTERS } from "@/lib/advanced-filters";
import type { Incident } from "@/lib/incidents";
import { IncidentQueue } from "./incident-queue";

function incident(overrides: Partial<Incident> & Pick<Incident, "id">): Incident {
  return {
    level: "HIGH",
    urgency: 7.5,
    createdAt: "2026-11-10T10:00:00Z",
    reporter: "+639171234567",
    reportedAt: "6:14 PM (GMT+8)",
    narrative: "Water over the curb",
    location: "Test Street cor. Example Road",
    barangay: "Cubao",
    source: "photo",
    hasPhoto: true,
    escalated: false,
    sensorMismatch: false,
    tags: ["photo"],
    incidentType: "report",
    ...overrides,
  };
}

const SOS = incident({
  id: "sos-1",
  urgency: null,
  reporter: "Driver",
  location: "EDSA northbound",
  barangay: "Kamuning",
  hasPhoto: false,
  tags: [],
  incidentType: "sos",
});

const REPORT = incident({ id: "rep-1" });

function props(overrides: Partial<Parameters<typeof IncidentQueue>[0]> = {}) {
  return {
    incidents: [SOS, REPORT],
    allIncidents: [SOS, REPORT],
    selectedId: "",
    filter: "all" as const,
    query: "",
    advanced: EMPTY_ADVANCED_FILTERS,
    view: "active" as const,
    dismissedCount: 0,
    onSelect: () => {},
    onDismiss: () => {},
    onRestore: () => {},
    onViewChange: () => {},
    onFilterChange: () => {},
    onQueryChange: () => {},
    onAdvancedChange: () => {},
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

test("lists incidents with masked reporter and urgency badges", () => {
  render(<IncidentQueue {...props()} />);

  expect(screen.getByText("#sos-1")).toBeTruthy();
  expect(screen.getByText("SOS")).toBeTruthy();
  expect(screen.getByText("Urgency 7.5")).toBeTruthy();
  expect(screen.getAllByText(/\+63 91\*\* \*\*\* \*\*\*\*/).length).toBeGreaterThan(0);
});

test("Open and Dismiss buttons fire their callbacks without selecting", () => {
  const calls: string[] = [];
  render(
    <IncidentQueue
      {...props({
        onSelect: (id) => calls.push(`select:${id}`),
        onDismiss: (id) => calls.push(`dismiss:${id}`),
      })}
    />,
  );

  fireEvent.click(screen.getAllByRole("button", { name: "Open" })[1]);
  fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);

  expect(calls).toEqual(["select:rep-1", "dismiss:sos-1"]);
});

test("dismissed view offers Restore and shows the purge countdown", () => {
  const calls: string[] = [];
  render(
    <IncidentQueue
      {...props({
        view: "dismissed",
        incidents: [
          incident({
            id: "old-1",
            dismissedAt: new Date(Date.now() - 10 * 3_600_000).toISOString(),
          }),
        ],
        onRestore: (id) => calls.push(`restore:${id}`),
      })}
    />,
  );

  expect(screen.getByText(/Deleted in \d+h/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  expect(calls).toEqual(["restore:old-1"]);
});

test("queue tabs, quick filters and search all report changes upward", () => {
  const seen: string[] = [];
  render(
    <IncidentQueue
      {...props({
        onViewChange: (v) => seen.push(`view:${v}`),
        onFilterChange: (f) => seen.push(`filter:${f}`),
        onQueryChange: (q) => seen.push(`query:${q}`),
      })}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /Dismissed/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Photo/ }));
  fireEvent.change(screen.getByLabelText("Search incidents"), { target: { value: "edsa" } });

  expect(seen).toEqual(["view:dismissed", "filter:photo", "query:edsa"]);
});

test("advanced panel patches filters and can be cleared", () => {
  const changes: unknown[] = [];
  render(
    <IncidentQueue
      {...props({
        advanced: { barangay: "Cubao", type: "report", maxAgeHours: 24, minUrgency: 5 },
        onAdvancedChange: (f) => changes.push(f),
      })}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Advanced filters" }));
  fireEvent.change(screen.getByLabelText("Filter by barangay"), { target: { value: "Kamuning" } });
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));

  expect(changes[0]).toMatchObject({ barangay: "Kamuning" });
  expect(changes[1]).toEqual(EMPTY_ADVANCED_FILTERS);
});

test("saving a preset stores it and applying it restores the filters", () => {
  const changes: unknown[] = [];
  const active = { barangay: "Cubao", type: "sos" as const, maxAgeHours: null, minUrgency: null };
  render(
    <IncidentQueue {...props({ advanced: active, onAdvancedChange: (f) => changes.push(f) })} />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Advanced filters" }));
  fireEvent.change(screen.getByLabelText("Preset name"), { target: { value: "Cubao SOS" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(window.localStorage.getItem("metroflow.queue.presets.v1")).toContain("Cubao SOS");

  // Re-render with an unrelated filter; the saved preset must still apply it.
  cleanup();
  render(
    <IncidentQueue
      {...props({ advanced: EMPTY_ADVANCED_FILTERS, onAdvancedChange: (f) => changes.push(f) })}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Advanced filters" }));
  fireEvent.change(screen.getByLabelText("Saved filter presets"), {
    target: { value: "Cubao SOS" },
  });

  expect(changes.at(-1)).toEqual(active);
});

test("bulk select dismisses every checked incident after confirmation", async () => {
  const dismissed: string[] = [];
  render(
    <IncidentQueue
      {...props({
        onDismiss: async (id) => {
          dismissed.push(id);
        },
      })}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  fireEvent.click(screen.getByText("#sos-1"));
  fireEvent.click(screen.getByText("#rep-1"));
  expect(screen.getByText("2 selected")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /Dismiss selected/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  await screen.findByText("Incoming Queue");
  expect(dismissed.sort()).toEqual(["rep-1", "sos-1"]);
});

test("error state shows the message and Retry calls onRetry", () => {
  let retries = 0;
  render(
    <IncidentQueue
      {...props({
        incidents: [],
        allIncidents: [],
        error: "Queue offline",
        onRetry: () => retries++,
      })}
    />,
  );

  expect(screen.getByText("Queue offline")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(retries).toBe(1);
});

test("empty queue explains itself and offers to clear an active quick filter", () => {
  const changes: string[] = [];
  render(
    <IncidentQueue
      {...props({
        incidents: [],
        allIncidents: [],
        filter: "photo",
        onFilterChange: (f) => changes.push(f),
      })}
    />,
  );

  expect(screen.getByText("No incidents match this filter")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Clear filter/ }));
  expect(changes).toEqual(["all"]);
});
