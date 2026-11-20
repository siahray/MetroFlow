import { describe, expect, test } from "bun:test";

import type { SOSRequest, Vehicle } from "./dispatch";
import type { HazardZone } from "./hazards";
import { summarizeOperations } from "./operations-summary";
import type { FieldReport } from "./reports";

function sos(overrides: Partial<SOSRequest>): SOSRequest {
  return {
    sos_id: 1,
    latitude: 14.6,
    longitude: 121.0,
    note: null,
    vehicle_id: null,
    status: "PENDING",
    created_at: "2026-11-17T08:00:00Z",
    ...overrides,
  };
}

function vehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    vehicle_id: 1,
    call_sign: "RESCUE-1",
    vehicle_type: "Truck",
    clearance_cm: 45,
    status: "AVAILABLE",
    current_location_lat: null,
    current_location_lon: null,
    speed_kmh: null,
    ...overrides,
  };
}

function report(overrides: Partial<FieldReport>): FieldReport {
  return {
    report_id: "00000000-0000-0000-0000-000000000001",
    reporter_hash: "hash",
    source: "PHOTO",
    depth_level: "KNEE",
    depth_label: "Knee-deep",
    status: "PENDING",
    latitude: 14.6,
    longitude: 121.0,
    location_plausible: true,
    barangay: null,
    narrative: null,
    urgency_score: 5,
    nearby_reports: 0,
    possible_duplicate_of: null,
    photo: null,
    exif: null,
    captured_at: null,
    submitted_at: "2026-11-17T08:00:00Z",
    duplicate_of: null,
    moderated_by: null,
    moderated_at: null,
    decision_reason: null,
    hazard_id: null,
    ...overrides,
  };
}

function hazard(overrides: Partial<HazardZone>): HazardZone {
  return {
    hazard_id: 1,
    name: "Flood",
    obstruction_level: "LEVEL_2",
    avg_depth_cm: 40,
    edge_id: null,
    notes: null,
    published_at: null,
    active: true,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe("summarizeOperations", () => {
  test("splits active SOS into assigned and unassigned and ignores resolved ones", () => {
    const summary = summarizeOperations({
      sos: [
        sos({ sos_id: 1 }),
        sos({ sos_id: 2, vehicle_id: 7, status: "dispatched" }),
        sos({ sos_id: 3, status: "RESOLVED" }),
      ],
      reports: [],
      vehicles: [],
      hazards: [],
    });

    expect(summary.activeSos).toBe(2);
    expect(summary.unassignedSos).toBe(1);
    expect(summary.assignedSos).toBe(1);
  });

  test("counts only available units and only active hazards", () => {
    const summary = summarizeOperations({
      sos: [],
      reports: [],
      vehicles: [
        vehicle({ vehicle_id: 1, status: "AVAILABLE" }),
        vehicle({ vehicle_id: 2, status: "DISPATCHED" }),
        vehicle({ vehicle_id: 3, status: null as unknown as string }),
      ],
      hazards: [hazard({ hazard_id: 1 }), hazard({ hazard_id: 2, active: false })],
    });

    expect(summary.availableUnits).toBe(2);
    expect(summary.totalUnits).toBe(3);
    expect(summary.activeHazards).toBe(1);
  });

  test("lists waiting incidents and reports oldest first, not in feed order", () => {
    const summary = summarizeOperations({
      sos: [
        sos({ sos_id: 1, created_at: "2026-11-17T09:00:00Z" }),
        sos({ sos_id: 2, created_at: "2026-11-17T07:00:00Z" }),
        sos({ sos_id: 3, vehicle_id: 7, created_at: "2026-11-17T06:00:00Z" }),
      ],
      reports: [
        report({ report_id: "b", submitted_at: "2026-11-17T09:30:00Z" }),
        report({ report_id: "a", submitted_at: "2026-11-17T08:30:00Z" }),
      ],
      vehicles: [],
      hazards: [],
    });

    // The assigned SOS is not waiting, however old it is.
    expect(summary.waitingSos.map((row) => row.sos_id)).toEqual([2, 1]);
    expect(summary.waitingReports.map((row) => row.report_id)).toEqual(["a", "b"]);
  });

  test("caps each waiting table at five rows", () => {
    const summary = summarizeOperations({
      sos: Array.from({ length: 8 }, (_, i) =>
        sos({ sos_id: i + 1, created_at: `2026-11-17T0${i}:00:00Z` }),
      ),
      reports: Array.from({ length: 8 }, (_, i) =>
        report({ report_id: `r${i}`, submitted_at: `2026-11-17T0${i}:00:00Z` }),
      ),
      vehicles: [],
      hazards: [],
    });

    expect(summary.waitingSos.map((row) => row.sos_id)).toEqual([1, 2, 3, 4, 5]);
    expect(summary.waitingReports.map((row) => row.report_id)).toEqual([
      "r0",
      "r1",
      "r2",
      "r3",
      "r4",
    ]);
  });

  test("rows without a readable timestamp cannot be waiting", () => {
    const summary = summarizeOperations({
      sos: [
        sos({ sos_id: 1, created_at: null }),
        sos({ sos_id: 2, created_at: "2026-11-17T07:00:00Z" }),
      ],
      reports: [report({ submitted_at: null })],
      vehicles: [],
      hazards: [],
    });

    expect(summary.waitingSos.map((row) => row.sos_id)).toEqual([2]);
    expect(summary.waitingReports).toEqual([]);
  });

  test("reports the empty board when nothing is open", () => {
    const summary = summarizeOperations({ sos: [], reports: [], vehicles: [], hazards: [] });

    expect(summary).toMatchObject({
      activeSos: 0,
      unassignedSos: 0,
      assignedSos: 0,
      pendingReports: 0,
      availableUnits: 0,
      totalUnits: 0,
      activeHazards: 0,
      waitingSos: [],
      waitingReports: [],
    });
  });
});
