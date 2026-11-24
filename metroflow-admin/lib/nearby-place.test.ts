import { afterEach, expect, test } from "bun:test";

import { nearbyPlace, searchPlaces } from "./nearby-place";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(body: unknown, ok = true) {
  globalThis.fetch = (async () => ({ ok, json: async () => body }) as Response) as typeof fetch;
}

test("nearbyPlace parses a Nominatim reverse row into name and address", async () => {
  mockFetch({
    name: "Quezon City Hall",
    display_name:
      "Quezon City Hall, Elliptical Road, Diliman, Quezon City, Metro Manila, Philippines",
    address: { city: "Quezon City" },
  });

  const result = await nearbyPlace(14.6464, 121.05);
  expect(result).toEqual({
    name: "Quezon City Hall",
    address: "Elliptical Road, Diliman",
  });
});

test("nearbyPlace falls back to the display name's first segment when no name is given", async () => {
  mockFetch({
    display_name: "Some Building, A. Mabini Street, Mandaluyong, Metro Manila, Philippines",
  });

  const result = await nearbyPlace(14.6, 121.0);
  expect(result?.name).toBe("Some Building");
});

test("nearbyPlace returns null on a failed request", async () => {
  mockFetch({}, false);
  expect(await nearbyPlace(14.6, 121.0)).toBeNull();
});

test("nearbyPlace returns null when Nominatim has nothing for the coordinate", async () => {
  mockFetch({});
  expect(await nearbyPlace(0, 0)).toBeNull();
});

test("searchPlaces maps Nominatim search rows to labelled coordinates", async () => {
  mockFetch([
    {
      display_name: "Quezon City Hall, Elliptical Road, Diliman, Quezon City, Philippines",
      lat: "14.6464",
      lon: "121.0500",
    },
  ]);

  expect(await searchPlaces("Quezon City Hall")).toEqual([
    {
      label: "Quezon City Hall, Elliptical Road, Diliman, Quezon City, Philippines",
      latitude: 14.6464,
      longitude: 121.05,
    },
  ]);
});

test("searchPlaces returns an empty list for a blank query without fetching", async () => {
  globalThis.fetch = (() => {
    throw new Error("should not be called");
  }) as typeof fetch;
  expect(await searchPlaces("   ")).toEqual([]);
});

test("searchPlaces returns an empty list on a failed request", async () => {
  mockFetch([], false);
  expect(await searchPlaces("flood")).toEqual([]);
});
