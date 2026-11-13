import { expect, test } from "bun:test";

import { navZoomFor } from "./geo";

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
