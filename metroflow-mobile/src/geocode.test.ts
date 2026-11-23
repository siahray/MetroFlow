import { afterEach, expect, test } from "bun:test";

import {
  boundingBoxOf,
  correctPlaceTypos,
  matchesSearchQuery,
  searchScore,
  splitGluedShorthand,
  normalizeSearchQuery,
  reverseGeocodeName,
  searchAddress,
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

test("searchPlaces returns geocoded addresses with no curated tier", async () => {
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
  const places = await searchPlaces("Quezon", { mapboxToken: "" });
  expect(places.map((p) => p.name)).toEqual(["Quezon City Polytechnic University"]);
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
    subtitle: "McKinley Parkway, Taguig, Metro Manila",
    label: "Market! Market!, McKinley Parkway, Taguig, Metro Manila, Philippines",
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

test("a Mapbox result outside the pilot box is still returned", async () => {
  globalThis.fetch = (async (input: unknown) => {
    const isMapbox = String(input).includes("api.mapbox.com");
    return {
      ok: true,
      json: async () =>
        isMapbox
          ? {
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
            }
          : [],
    } as Response;
  }) as typeof fetch;

  const places = await searchPlaces("Market market", {
    proximity: { latitude: 14.65, longitude: 121.05 },
    mapboxToken: "test-token",
  });
  expect(places.some((p) => p.name === "Market! Market!")).toBe(true);
});

test("reverseGeocodeName resolves a dropped pin's coordinate to an exact address", async () => {
  mockFetch({
    features: [
      { id: "poi.1", text: "Quezon Memorial Circle", place_name: "Quezon Memorial Circle, Diliman, Quezon City, Philippines" },
    ],
  });
  expect(await reverseGeocodeName(14.6517, 121.0493, undefined, "test-token")).toBe(
    "Quezon Memorial Circle, Diliman, Quezon City",
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

test("normalizeSearchQuery expands PH abbreviations and leaves other words alone", () => {
  expect(normalizeSearchQuery("  brgy hall batasan  ")).toBe("Barangay hall batasan");
  expect(normalizeSearchQuery("QC HALL")).toBe("Quezon City HALL");
  expect(normalizeSearchQuery("katipunan ave.")).toBe("katipunan Avenue");
  expect(normalizeSearchQuery("subd. st. hosp. ctr. elem. h.s. St Ave HOSP CTR ELEM HS")).toBe(
    "Subdivision Street Hospital Center Elementary High School Street Avenue Hospital Center Elementary High School",
  );
  expect(normalizeSearchQuery(normalizeSearchQuery("brgy. qc"))).toBe("Barangay Quezon City");
});

test("normalizeSearchQuery expands dotted and long-form place abbreviations", () => {
  expect(normalizeSearchQuery("q.c. hall")).toBe("Quezon City hall");
  expect(normalizeSearchQuery("bgy. batasan blvd.")).toBe("Barangay batasan Boulevard");
  expect(normalizeSearchQuery("univ. mkt. cntr. rd.")).toBe("University Market Center Road");
});

test("matchesSearchQuery accepts abbreviations and a single minor typo", () => {
  expect(matchesSearchQuery("q.c. hall", "Quezon City Hall, Quezon City")).toBe(true);
  expect(matchesSearchQuery("st lukes qc", "St. Luke's Medical Center, Quezon City")).toBe(true);
  expect(matchesSearchQuery("up", "University of the Philippines Diliman")).toBe(true);
  expect(matchesSearchQuery("Qezon City Hall", "Quezon City Hall")).toBe(true);
  expect(matchesSearchQuery("Qeuzon City Hall", "Quezon City Hall")).toBe(true);
  // Short words stay exact: autocomplete's "Fall Street" is not "Hall Street".
  expect(matchesSearchQuery("hall", "Fall Street")).toBe(false);
  expect(matchesSearchQuery("Bxtxsan Hills", "Batasan Hills")).toBe(false);
});

test("splitGluedShorthand splits brand prefixes without breaking whole words", () => {
  expect(splitGluedShorthand("smnorth")).toBe("sm north");
  expect(splitGluedShorthand("qchall")).toBe("qc hall");
  expect(splitGluedShorthand("updiliman")).toBe("up diliman");
  expect(splitGluedShorthand("street katipunan")).toBe("street katipunan");
  expect(splitGluedShorthand("katipunan Avenue")).toBe("katipunan Avenue");
});

test("searchScore ranks exact matches above near ones and rejects wrong words", () => {
  expect(searchScore("Quezon City Hall", "Quezon City Hall")).toBeGreaterThan(
    searchScore("Quezon City Hall", "Quezon City Hall Extension"),
  );
  expect(searchScore("Qezon City Hall", "Quezon City Hall")).toBeGreaterThan(0);
  expect(searchScore("hall", "Fall Street")).toBe(0);
});

test("correctPlaceTypos fixes a misspelled place word and keeps the rest", () => {
  expect(correctPlaceTypos("Qezon City Hall")).toBe("quezon City Hall");
  expect(correctPlaceTypos("Barangay hall batasan")).toBe("Barangay hall batasan");
});

test("searchPlaces queries the geocoder with the expanded landmark name", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    urls.push(String(input));
    return { ok: true, json: async () => ({ features: [] }) } as Response;
  }) as typeof fetch;

  await searchPlaces("sm nroth", { mapboxToken: "test-token" });
  expect(decodeURIComponent(new URL(urls[0]).pathname)).toContain("sm north");

  await searchPlaces("Qezon City Hall", { mapboxToken: "test-token" });
  expect(new URL(urls[3]).searchParams.get("q")).toBe("quezon City Hall");
});

test("searchPlaces accepts a glued abbreviation like smnorth", async () => {
  globalThis.fetch = (async (input: unknown) => {
    const isMapbox = String(input).includes("api.mapbox.com");
    return {
      ok: true,
      json: async () =>
        isMapbox
          ? {
              features: [
                {
                  id: "poi.1",
                  text: "SM North EDSA",
                  place_name: "SM North EDSA, Bago Bantay, Quezon City, Metro Manila, Philippines",
                  place_type: ["poi"],
                  center: [121.0286, 14.6565],
                },
              ],
            }
          : [],
    } as Response;
  }) as typeof fetch;

  expect(await searchPlaces("smnorth", { mapboxToken: "test-token" })).toMatchObject([
    { name: "SM North EDSA" },
  ]);
});

test("searchPlaces keeps a geocoder hit whose name has one typo", async () => {
  globalThis.fetch = (async (input: unknown) => {
    const isMapbox = String(input).includes("api.mapbox.com");
    return {
      ok: true,
      json: async () =>
        isMapbox
          ? {
              features: [
                {
                  id: "poi.1",
                  text: "Quezon City Hall",
                  place_name: "Quezon City Hall, Quezon City, Metro Manila, Philippines",
                  place_type: ["poi"],
                  center: [121.0493, 14.6517],
                },
              ],
            }
          : [],
    } as Response;
  }) as typeof fetch;

  expect(await searchPlaces("Qezon City Hall", { mapboxToken: "test-token" })).toMatchObject([
    { name: "Quezon City Hall" },
  ]);
});

test("searchMapbox fences results to Metro Manila and biases by the driver", async () => {
  let requestedUrl = "";
  globalThis.fetch = (async (input: unknown) => {
    requestedUrl = String(input);
    return { ok: true, json: async () => ({ features: [] }) } as Response;
  }) as typeof fetch;

  expect(
    await searchMapbox("katipunan ave", { latitude: 14.65, longitude: 121.05 }, undefined, "test-token"),
  ).toEqual([]);

  const url = new URL(requestedUrl);
  expect(url.pathname).toContain(encodeURIComponent("katipunan Avenue"));
  expect(url.searchParams.get("bbox")).toBe("120.90,14.35,121.15,14.78");
  expect(url.searchParams.get("types")).toBe("poi,address,neighborhood,locality,place");
  expect(url.searchParams.get("autocomplete")).toBe("true");
  expect(url.searchParams.get("country")).toBe("ph");
  expect(url.searchParams.get("proximity")).toBe("121.05,14.65");
});

test("searchAddress bounds and normalizes the Nominatim fallback request", async () => {
  let requestedUrl = "";
  globalThis.fetch = (async (input: unknown) => {
    requestedUrl = String(input);
    return { ok: true, json: async () => [] } as Response;
  }) as typeof fetch;

  expect(await searchAddress("  brgy hall batasan ")).toEqual([]);

  const url = new URL(requestedUrl);
  expect(url.searchParams.get("q")).toBe("Barangay hall batasan");
  expect(url.searchParams.get("viewbox")).toBe("120.90,14.78,121.15,14.35");
  expect(url.searchParams.get("bounded")).toBe("1");
  expect(url.searchParams.get("countrycodes")).toBe("ph");
  expect(url.searchParams.get("addressdetails")).toBe("1");
});

test("Nominatim subtitle falls back to village then city when no road is given", async () => {
  mockFetch([
    {
      place_id: 7,
      display_name: "Barangay Hall, Batasan Hills, Quezon City, Philippines",
      lat: "14.69",
      lon: "121.09",
      address: { village: "Batasan Hills", city: "Quezon City" },
    },
  ]);
  const [result] = await searchAddress("barangay hall", BOX);
  expect(result.subtitle).toBe("Batasan Hills, Quezon City");
});

test("searchPlaces normalizes both live tiers, dedupes and ranks by driver proximity", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("api.mapbox.com")) {
      return { ok: true, json: async () => ({ features: [] }) } as Response;
    }
    return {
      ok: true,
      json: async () => [
        {
          place_id: 1,
          name: "Batasan Barangay Hall",
          display_name: "Batasan Barangay Hall, Batasan Road, Batasan Hills, Quezon City, Philippines",
          lat: "14.6921",
          lon: "121.094",
          address: { road: "Batasan Road", suburb: "Batasan Hills", city: "Quezon City" },
        },
        {
          place_id: 2,
          name: "Nearby Barangay Hall",
          display_name: "Nearby Barangay Hall, Batasan Road, Quezon City, Philippines",
          lat: "14.657",
          lon: "121.029",
          address: { road: "Batasan Road", city: "Quezon City" },
        },
      ],
    } as Response;
  }) as typeof fetch;

  const results = await searchPlaces("brgy hall batasan", {
    proximity: { latitude: 14.6565, longitude: 121.0286 },
    mapboxToken: "test-token",
  });

  expect(new URL(urls[0]).pathname).toContain(encodeURIComponent("Barangay hall batasan"));
  expect(new URL(urls[1]).searchParams.get("q")).toBe("Barangay hall batasan");
  expect(results.length).toBeLessThanOrEqual(8);
  expect(results.map((place) => place.name)).toEqual(["Nearby Barangay Hall", "Batasan Barangay Hall"]);
});

test("an exact name from OSM outranks a closer Mapbox fuzzy match", async () => {
  globalThis.fetch = (async (input: unknown) => {
    const isMapbox = String(input).includes("api.mapbox.com");
    return {
      ok: true,
      json: async () =>
        isMapbox
          ? {
              features: [
                {
                  id: "addr.1",
                  text: "Katipunan Avenue Extension",
                  place_name: "Katipunan Avenue Extension, Bagbag, Quezon City, Metro Manila, Philippines",
                  place_type: ["address"],
                  center: [121.024, 14.697],
                },
              ],
            }
          : [
              {
                place_id: 5,
                name: "Katipunan Avenue",
                display_name: "Katipunan Avenue, Diliman, Quezon City, Philippines",
                lat: "14.6555",
                lon: "121.0742",
                address: { road: "Katipunan Avenue", city: "Quezon City" },
              },
            ],
    } as Response;
  }) as typeof fetch;

  const results = await searchPlaces("katipunan ave", {
    proximity: { latitude: 14.6565, longitude: 121.0286 },
    mapboxToken: "test-token",
  });
  expect(results[0].name).toBe("Katipunan Avenue");
});
