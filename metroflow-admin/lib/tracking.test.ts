import { describe, expect, test } from "bun:test";

import type { SOSRequest, Vehicle } from "./dispatch";
import { fixState, responderTrack } from "./tracking";

const NOW = Date.parse("2026-11-17T10:00:00Z");

function isoSecondsAgo(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

function vehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    vehicle_id: 3,
    call_sign: "RESCUE-3",
    vehicle_type: "Truck",
    clearance_cm: 45,
    status: "DISPATCHED",
    current_location_lat: 14.6,
    current_location_lon: 121.0,
    speed_kmh: 30,
    updated_at: isoSecondsAgo(5),
    ...overrides,
  };
}

const SOS: SOSRequest = {
  sos_id: 9,
  latitude: 14.61,
  longitude: 121.01,
  note: null,
  vehicle_id: 3,
  status: "dispatched",
  created_at: "2026-11-17T09:50:00Z",
};

describe("fixState", () => {
  test("a fix under a minute old is live", () => {
    expect(fixState(isoSecondsAgo(30), NOW)).toBe("live");
  });

  test("a fix a few minutes old is stale", () => {
    expect(fixState(isoSecondsAgo(180), NOW)).toBe("stale");
  });

  test("an old fix is offline", () => {
    expect(fixState(isoSecondsAgo(3600), NOW)).toBe("offline");
  });

  test("a missing or unreadable timestamp is unknown, not live", () => {
    expect(fixState(null, NOW)).toBe("unknown");
    expect(fixState("not-a-time", NOW)).toBe("unknown");
  });

  test("the API's naive UTC timestamps are read as UTC", () => {
    // 10:00:30 stored without a zone means 10:00:30Z, i.e. 30 s ago, not 8 h ago.
    expect(fixState("2026-11-17T10:00:30", NOW)).toBe("live");
  });
});

describe("responderTrack", () => {
  test("returns null until a unit is assigned", () => {
    expect(responderTrack({ ...SOS, vehicle_id: null }, [vehicle({})], NOW)).toBeNull();
  });

  test("returns null when the assigned unit is not in the fleet list", () => {
    expect(responderTrack(SOS, [vehicle({ vehicle_id: 99 })], NOW)).toBeNull();
  });

  test("measures distance and ETA from the unit's reported position", () => {
    const track = responderTrack(SOS, [vehicle({})], NOW);

    expect(track?.unit.call_sign).toBe("RESCUE-3");
    expect(track?.fix).toBe("live");
    // ~1.5 km away at 30 km/h is a ~3 min straight-line estimate.
    expect(track?.distanceKm).toBeGreaterThan(1);
    expect(track?.distanceKm).toBeLessThan(2);
    expect(track?.etaMinutes).toBe(3);
  });

  test("a unit with no reported position has no distance or ETA", () => {
    const track = responderTrack(
      SOS,
      [vehicle({ current_location_lat: null, current_location_lon: null })],
      NOW,
    );

    expect(track?.distanceKm).toBeNull();
    expect(track?.etaMinutes).toBeNull();
  });
});
