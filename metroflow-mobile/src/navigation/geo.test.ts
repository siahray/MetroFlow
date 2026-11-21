import { expect, test } from "bun:test";

import type { RouteSegment } from "../api";
import {
  bearingDegrees,
  formatDurationHrMin,
  navZoomFor,
  routeBearing,
  routeSuccessRate,
  snapToRoute,
} from "./geo";

function segment(distance_m: number, water_depth_cm: number): RouteSegment {
  return {
    edge_id: 0,
    start_node_id: 0,
    end_node_id: 1,
    road_name: null,
    distance_m,
    water_depth_cm,
    status: "PASSABLE",
  };
}

test("routeSuccessRate is 100 for an all-dry route", () => {
  expect(routeSuccessRate([segment(100, 0), segment(200, 0)], 28)).toBe(100);
});

test("routeSuccessRate is 0 when every segment is deeper than clearance", () => {
  expect(routeSuccessRate([segment(100, 30), segment(100, 50)], 28)).toBe(0);
});

test("routeSuccessRate weights each segment by its distance", () => {
  // 100 m dry (100%) + 100 m at 14 cm on a 28 cm vehicle (50%) => 75%.
  expect(routeSuccessRate([segment(100, 0), segment(100, 14)], 28)).toBe(75);
  // Doubling the dry stretch pulls the score toward 100%.
  expect(routeSuccessRate([segment(200, 0), segment(100, 14)], 28)).toBe(83);
});

test("routeSuccessRate returns null with no segments, no clearance, or a zero-length route", () => {
  expect(routeSuccessRate([], 28)).toBeNull();
  expect(routeSuccessRate([segment(100, 0)], 0)).toBeNull();
  expect(routeSuccessRate([segment(0, 0)], 28)).toBeNull();
});

test("formatDurationHrMin shows hours and minutes, rounding the total", () => {
  expect(formatDurationHrMin(90)).toBe("1 Hr : 30 Min");
  expect(formatDurationHrMin(25.6)).toBe("0 Hr : 26 Min");
  expect(formatDurationHrMin(125)).toBe("2 Hr : 5 Min");
  expect(formatDurationHrMin(-3)).toBe("0 Hr : 0 Min");
});

test("navZoomFor zooms in at low speed and out at highway speed", () => {
  // zoom rises and altitude falls together -- they must never disagree on
  // direction, since one drives Android and the other drives iOS.
  expect(navZoomFor(10, null, "STRAIGHT")).toEqual({ zoom: 18.0, altitude: 250 });
  expect(navZoomFor(30, null, "STRAIGHT")).toEqual({ zoom: 17.5, altitude: 400 });
  expect(navZoomFor(55, null, "STRAIGHT")).toEqual({ zoom: 16.5, altitude: 800 });
  expect(navZoomFor(90, null, "STRAIGHT")).toEqual({ zoom: 15.5, altitude: 1600 });
});

test("navZoomFor falls back to the default zoom with no speed fix yet", () => {
  expect(navZoomFor(null, null, "STRAIGHT")).toEqual({ zoom: 17.5, altitude: 400 });
});

test("navZoomFor zooms in for a close turn regardless of speed", () => {
  expect(navZoomFor(90, 80, "TURN_LEFT")).toEqual({ zoom: 18.3, altitude: 200 });
  expect(navZoomFor(10, 80, "TURN_RIGHT")).toEqual({ zoom: 18.3, altitude: 200 });
});

test("navZoomFor ignores a far-off turn and a straight/depart/arrive manoeuvre", () => {
  expect(navZoomFor(90, 80, "STRAIGHT")).toEqual({ zoom: 15.5, altitude: 1600 });
  expect(navZoomFor(90, 500, "TURN_LEFT")).toEqual({ zoom: 15.5, altitude: 1600 });
  expect(navZoomFor(10, 50, "ARRIVE")).toEqual({ zoom: 18.0, altitude: 250 });
});

test("navZoomFor never returns a zoom/altitude pair that disagree on direction", () => {
  // Across every tier, a higher zoom must pair with a lower altitude.
  const tiers = [
    navZoomFor(90, 80, "TURN_LEFT"),
    navZoomFor(10, null, "STRAIGHT"),
    navZoomFor(null, null, "STRAIGHT"),
    navZoomFor(30, null, "STRAIGHT"),
    navZoomFor(55, null, "STRAIGHT"),
    navZoomFor(90, null, "STRAIGHT"),
  ];
  for (let i = 1; i < tiers.length; i++) {
    expect(tiers[i].zoom).toBeLessThanOrEqual(tiers[i - 1].zoom);
    expect(tiers[i].altitude).toBeGreaterThanOrEqual(tiers[i - 1].altitude);
  }
});

test("snapToRoute moves a point off the line onto its nearest point on the route", () => {
  const route = [
    { latitude: 14.6, longitude: 121.0 },
    { latitude: 14.6, longitude: 121.01 },
  ];
  // East of the midpoint, well off the (flat, east-west) line.
  const offRoute = { latitude: 14.6005, longitude: 121.005 };
  const snapped = snapToRoute(route, offRoute);
  expect(snapped).not.toBeNull();
  expect(snapped!.latitude).toBeCloseTo(14.6, 3);
  expect(snapped!.longitude).toBeCloseTo(121.005, 3);
});

test("snapToRoute clamps to an endpoint when the point is past the end of the route", () => {
  const route = [
    { latitude: 14.6, longitude: 121.0 },
    { latitude: 14.6, longitude: 121.01 },
  ];
  const pastTheEnd = { latitude: 14.6, longitude: 121.05 };
  expect(snapToRoute(route, pastTheEnd)).toEqual(route[1]);
});

test("snapToRoute returns null for a degenerate (single-point) route", () => {
  expect(snapToRoute([{ latitude: 14.6, longitude: 121.0 }], { latitude: 14.6, longitude: 121.0 })).toBeNull();
});

test("bearingDegrees points clockwise from north", () => {
  const here = { latitude: 14.6, longitude: 121.0 };
  expect(bearingDegrees(here, { latitude: 14.61, longitude: 121.0 })).toBeCloseTo(0, 0);
  expect(bearingDegrees(here, { latitude: 14.6, longitude: 121.01 })).toBeCloseTo(90, 0);
  expect(bearingDegrees(here, { latitude: 14.59, longitude: 121.0 })).toBeCloseTo(180, 0);
  expect(bearingDegrees(here, { latitude: 14.6, longitude: 120.99 })).toBeCloseTo(270, 0);
});

test("routeBearing looks 30m ahead along the route, including around a corner", () => {
  const route = [
    { latitude: 14.6, longitude: 121.0 },
    { latitude: 14.6, longitude: 121.01 },
    { latitude: 14.61, longitude: 121.01 },
  ];
  expect(routeBearing(route, { latitude: 14.6, longitude: 121.005 })).toBeCloseTo(90, 0);
  // ~10m before the corner, the 30m lookahead has already turned north.
  expect(routeBearing(route, { latitude: 14.6, longitude: 121.0099 })).toBeCloseTo(0, 0);
});

test("routeBearing returns null without enough route to look ahead", () => {
  expect(routeBearing([{ latitude: 14.6, longitude: 121.0 }], { latitude: 14.6, longitude: 121.0 })).toBeNull();
});
