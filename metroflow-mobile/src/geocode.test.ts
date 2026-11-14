import { afterEach, expect, test } from "bun:test";

import {
  boundingBoxOf,
  reverseGeocodeName,
  searchAddress,
  searchCuratedPlaces,
  searchMapbox,
  searchPlaces,
} from "./geocode";

const BOX = { south: 14.5, west: 121.0, north: 14.75, east: 121.15 };

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

test("parses Nominatim rows into GeocodeResult with clean name and subtitle", async () => {
  mockFetch([
    {
      place_id: 12345,
      name: "SM City North EDSA",
      display_name: "SM City North EDSA, Epifanio de los Santos Avenue, Sto. Cristo, Quezon City, Metro Manila, Philippines",
      category: "shop",
      type: "mall",
      lat: "14.6565",
      lon: "121.0286",
      address: {
        road: "Epifanio de los Santos Avenue",
        suburb: "Sto. Cristo",
        city: "Quezon City",
      },
    },
  ]);
  const results = await searchAddress("SM North", BOX);
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "osm-12345",
    name: "SM City North EDSA",
    label: "SM City North EDSA",
    subtitle: "Epifanio de los Santos Avenue, Quezon City",
    category: "mall",
    latitude: 14.6565,
    longitude: 121.0286,
  });
});

test("a malformed row (non-numeric coordinates) is dropped, not thrown", async () => {
  mockFetch([{ display_name: "Bad row", lat: "not-a-number", lon: "121.0" }]);
  expect(await searchAddress("Bad row", BOX)).toEqual([]);
});

test("an HTTP failure returns no results instead of throwing", async () => {
  mockFetch({}, false);
  expect(await searchAddress("Anything", BOX)).toEqual([]);
});

test("searchCuratedPlaces matches prominent landmarks instantly without network", () => {
  const smMatches = searchCuratedPlaces("sm north");
  expect(smMatches.length).toBeGreaterThan(0);
  expect(smMatches[0].name).toBe("SM City North EDSA");
  expect(smMatches[0].category).toBe("mall");

  const hospitalMatches = searchCuratedPlaces("heart center");
  expect(hospitalMatches.length).toBeGreaterThan(0);
  expect(hospitalMatches[0].name).toBe("Philippine Heart Center");
  expect(hospitalMatches[0].category).toBe("hospital");

  const qcHallMatches = searchCuratedPlaces("qc hall");
  expect(qcHallMatches.length).toBeGreaterThan(0);
  expect(qcHallMatches[0].name).toBe("Quezon City Hall");
  expect(qcHallMatches[0].category).toBe("government");
});

test("searchPlaces merges curated results with geocoded addresses", async () => {
  mockFetch([
    {
      place_id: 9999,
      name: "Quezon City Polytechnic University",
      display_name: "QCPU, San Bartolome, Novaliches, Quezon City",
      category: "amenity",
      type: "university",
      lat: "14.7011",
      lon: "121.0355",
    },
  ]);

  // No token forces the Nominatim fallback regardless of the test environment.
  const places = await searchPlaces("Quezon", { box: BOX, mapboxToken: "" });
  expect(places.length).toBeGreaterThan(0);
  // Contains curated place like Quezon City Hall
  expect(places.some((p) => p.name.includes("Quezon"))).toBe(true);
});

test("searchMapbox parses POI features with name, subtitle and coordinates", async () => {
  mockFetch({
    features: [
      {
        id: "poi.123",
        text: "Market! Market!",
        place_name: "Market! Market!, McKinley Parkway, Taguig, Metro Manila, Philippines",
        place_type: ["poi"],
        center: [121.0565, 14.5505],
        properties: { category: "shopping mall" },
      },
      { id: "poi.bad", text: "No coords", place_name: "Broken", place_type: ["poi"] },
    ],
  });

  const results = await searchMapbox(
    "Market market",
    { latitude: 14.65, longitude: 121.05 },
    undefined,
    "test-token",
  );
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({
    name: "Market! Market!",
    subtitle: "McKinley Parkway, Taguig",
    category: "mall",
    latitude: 14.5505,
    longitude: 121.0565,
  });
});

test("searchMapbox without a token never calls the network", async () => {
  globalThis.fetch = (() => {
    throw new Error("should not be called");
  }) as unknown as typeof fetch;
  expect(await searchMapbox("Market market", null, undefined, "")).toEqual([]);
});

test("a Mapbox result outside the pilot box is kept, ranked after curated hits", async () => {
  mockFetch({
    features: [
      {
        id: "poi.123",
        text: "Market! Market!",
        place_name: "Market! Market!, McKinley Parkway, Taguig, Metro Manila, Philippines",
        place_type: ["poi"],
        center: [121.0565, 14.5505], // south of BOX -- outside the pilot network
        properties: { category: "shopping mall" },
      },
    ],
  });

  const places = await searchPlaces("Market market", {
    box: BOX,
    proximity: { latitude: 14.65, longitude: 121.05 },
    mapboxToken: "test-token",
  });
  expect(places.some((p) => p.name === "Market! Market!")).toBe(true);
});

test("reverseGeocodeName resolves a dropped pin's coordinate to a place name", async () => {
  mockFetch({
    features: [
      { id: "poi.1", text: "Quezon Memorial Circle", place_name: "Quezon Memorial Circle, Diliman, Quezon City" },
    ],
  });
  expect(await reverseGeocodeName(14.6517, 121.0493, undefined, "test-token")).toBe(
    "Quezon Memorial Circle",
  );
});

test("reverseGeocodeName returns null without a token, never calling the network", async () => {
  globalThis.fetch = (() => {
    throw new Error("should not be called");
  }) as unknown as typeof fetch;
  expect(await reverseGeocodeName(14.6517, 121.0493, undefined, "")).toBeNull();
});

test("reverseGeocodeName returns null when Mapbox has nothing for the coordinate", async () => {
  mockFetch({ features: [] });
  expect(await reverseGeocodeName(0, 0, undefined, "test-token")).toBeNull();
});
