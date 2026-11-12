import { afterEach, expect, test } from "bun:test";

import { boundingBoxOf, searchAddress } from "./geocode";

const BOX = { south: 14.5, west: 121.0, north: 14.6, east: 121.1 };

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(body: unknown, ok = true) {
  globalThis.fetch = (async () =>
    ({
      ok,
      json: async () => body,
    }) as Response) as typeof fetch;
}

test("boundingBoxOf wraps the given points", () => {
  expect(
    boundingBoxOf([
      { latitude: 14.55, longitude: 121.05 },
      { latitude: 14.6, longitude: 121.02 },
    ]),
  ).toEqual({ south: 14.55, west: 121.02, north: 14.6, east: 121.05 });
});

test("boundingBoxOf returns null for an empty network", () => {
  expect(boundingBoxOf([])).toBeNull();
});

test("a query under the minimum length never calls the network", async () => {
  globalThis.fetch = (() => {
    throw new Error("should not be called");
  }) as unknown as typeof fetch;
  expect(await searchAddress("ab", BOX)).toEqual([]);
});

test("parses Nominatim rows into GeocodeResult", async () => {
  mockFetch([
    { display_name: "Shaw Boulevard, Mandaluyong", lat: "14.5834", lon: "121.0409" },
  ]);
  expect(await searchAddress("Shaw Boulevard", BOX)).toEqual([
    { label: "Shaw Boulevard, Mandaluyong", latitude: 14.5834, longitude: 121.0409 },
  ]);
});

test("a malformed row (non-numeric coordinates) is dropped, not thrown", async () => {
  mockFetch([{ display_name: "Bad row", lat: "not-a-number", lon: "121.0" }]);
  expect(await searchAddress("Bad row", BOX)).toEqual([]);
});

test("an HTTP failure returns no results instead of throwing", async () => {
  mockFetch({}, false);
  expect(await searchAddress("Anything", BOX)).toEqual([]);
});
