import type { LatLng } from "./navigation/geo";

/**
 * Establishment and place categories for display icons and grouping.
 */
export type PlaceCategory =
  | "mall"
  | "hospital"
  | "university"
  | "government"
  | "transit"
  | "landmark"
  | "commercial"
  | "address";

export type GeocodeResult = {
  id?: string;
  name: string;
  label: string;
  subtitle: string;
  category?: PlaceCategory;
  latitude: number;
  longitude: number;
};

export type BoundingBox = { south: number; west: number; north: number; east: number };

/** The box every result must fall inside, from whatever points are on screen. */
export function boundingBoxOf(points: LatLng[]): BoundingBox | null {
  if (points.length === 0) return null;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const point of points) {
    if (point.latitude < south) south = point.latitude;
    if (point.latitude > north) north = point.latitude;
    if (point.longitude < west) west = point.longitude;
    if (point.longitude > east) east = point.longitude;
  }
  return { south, west, north, east };
}

function cleanEstablishmentName(rawName?: string, displayName?: string): string {
  if (rawName && rawName.trim().length > 0) {
    return rawName.trim();
  }
  if (!displayName) return "Location";
  // Fall back to first segment before comma
  const firstSegment = displayName.split(",")[0]?.trim();
  return firstSegment || displayName;
}

type NominatimAddress = {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
};

function formatSubtitle(address?: NominatimAddress, displayName?: string): string {
  if (address) {
    const primary = address.road || address.suburb || address.neighbourhood || address.village;
    const secondary = address.city || address.town || address.municipality || address.county;
    if (primary && secondary && primary !== secondary) {
      return `${primary}, ${secondary}`;
    }
    if (primary) return primary;
    if (secondary) return secondary;
  }
  if (!displayName) return "Address";
  const parts = displayName.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 2) {
    return `${parts[1]}, ${parts[2]}`;
  }
  if (parts.length > 1) {
    return parts[1];
  }
  return parts[0] || "Address";
}

function inferCategory(category?: string, type?: string): PlaceCategory {
  const cat = (category || "").toLowerCase();
  const typ = (type || "").toLowerCase();

  if (typ === "mall" || typ === "supermarket" || typ === "department_store" || cat === "shop") {
    return "mall";
  }
  if (typ === "hospital" || typ === "clinic" || typ === "doctors" || typ === "pharmacy") {
    return "hospital";
  }
  if (typ === "university" || typ === "college" || typ === "school") {
    return "university";
  }
  if (
    typ === "townhall" ||
    typ === "government" ||
    typ === "police" ||
    typ === "fire_station" ||
    typ === "courthouse"
  ) {
    return "government";
  }
  if (
    typ === "station" ||
    typ === "subway_entrance" ||
    typ === "bus_stop" ||
    typ === "tram_stop" ||
    cat === "railway"
  ) {
    return "transit";
  }
  if (
    cat === "tourism" ||
    cat === "leisure" ||
    typ === "attraction" ||
    typ === "stadium" ||
    typ === "monument"
  ) {
    return "landmark";
  }
  if (cat === "commercial" || cat === "office") {
    return "commercial";
  }
  return "address";
}

const MIN_QUERY_LENGTH = 3;

/** Fixed Metro Manila fence used when no caller box applies: west,south,east,north. */
const METRO_MANILA_BOX: BoundingBox = { south: 14.35, west: 120.9, north: 14.78, east: 121.15 };

const QUERY_ABBREVIATIONS: Record<string, string> = {
  "brgy.": "Barangay",
  brgy: "Barangay",
  "bgy.": "Barangay",
  bgy: "Barangay",
  "subd.": "Subdivision",
  subd: "Subdivision",
  "q.c.": "Quezon City",
  "q.c": "Quezon City",
  qc: "Quezon City",
  "st.": "Street",
  st: "Street",
  "ave.": "Avenue",
  ave: "Avenue",
  "blvd.": "Boulevard",
  blvd: "Boulevard",
  "rd.": "Road",
  rd: "Road",
  "dr.": "Drive",
  dr: "Drive",
  "hosp.": "Hospital",
  hosp: "Hospital",
  "ctr.": "Center",
  ctr: "Center",
  "cntr.": "Center",
  cntr: "Center",
  "univ.": "University",
  univ: "University",
  "mkt.": "Market",
  mkt: "Market",
  "pob.": "Poblacion",
  pob: "Poblacion",
  "dist.": "District",
  dist: "District",
  "elem.": "Elementary",
  elem: "Elementary",
  "h.s.": "High School",
  hs: "High School",
};

/** Expand local address shorthand so every tier searches the same full words. */
export function normalizeSearchQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => QUERY_ABBREVIATIONS[token.toLowerCase()] ?? token)
    .filter(Boolean)
    .join(" ");
}

/** Words as the matcher sees them: abbreviations expanded, punctuation gone. */
export function searchTokens(text: string): string[] {
  return normalizeSearchQuery(text)
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** One insertion, deletion, substitution or adjacent letter swap. */
function hasOneTypo(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (a.length < b.length) j += 1;
    else if (a[i + 1] === b[j] && a[i] === b[j + 1]) {
      i += 2; // "Qeuzon" -> "Quezon"
      j += 2;
    } else {
      i += 1;
      j += 1;
    }
  }
  return true;
}

/** Initials of the meaningful words, so "up" can mean University Philippines. */
function initialsOf(words: string[]): string {
  return words
    .filter((word) => !["of", "the", "and", "de", "del", "la"].includes(word))
    .map((word) => word[0])
    .join("");
}

/**
 * True when every query word appears in the text words, as an acronym's
 * initials, or with one small typo in a longer word. Short words stay exact
 * so "hall" never matches "fall".
 */
export function matchesTokens(needles: string[], words: string[]): boolean {
  if (needles.length === 0) return false;
  const initials = initialsOf(words);
  return needles.every(
    (needle) =>
      words.some((word) => word.includes(needle)) ||
      (needle.length >= 2 && needle.length <= 5 && initials.includes(needle)) ||
      (needle.length >= 5 && words.some((word) => word.length >= 5 && hasOneTypo(needle, word))),
  );
}

/** Convenience for a single query/text pair; callers with many texts precompute tokens once. */
export function matchesSearchQuery(query: string, text: string): boolean {
  return matchesTokens(searchTokens(query), searchTokens(text));
}

/**
 * Score a result against the query: whole-string closeness first, then every
 * word must account for itself (exact, prefix, substring, or one typo).
 * Zero means "not a match"; higher means a better match.
 */
export function searchScore(query: string, text: string): number {
  const needles = searchTokens(query);
  const words = searchTokens(text);
  if (needles.length === 0 || words.length === 0) return 0;

  const compactQuery = needles.join("");
  const compactText = words.join("");
  let score =
    compactQuery === compactText
      ? 100
      : compactText.startsWith(compactQuery)
        ? 80
        : compactText.includes(compactQuery)
          ? 60
          : hasOneTypo(compactQuery, compactText)
            ? 30
            : 0;

  const initials = initialsOf(words);
  for (const needle of needles) {
    const best = Math.max(
      ...words.map((word) => {
        if (word === needle) return 4;
        if (word.startsWith(needle)) return 3;
        if (word.includes(needle)) return 2;
        return needle.length >= 5 && word.length >= 5 && hasOneTypo(needle, word) ? 1 : 0;
      }),
      needle.length >= 2 && needle.length <= 5 && initials.includes(needle) ? 1 : 0,
    );
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

/** Generic words used to split glued shorthand and fix a letter out of place. */
const PLACE_WORDS = new Set([
  ...Object.values(QUERY_ABBREVIATIONS).flatMap(searchTokens),
  "north",
  "south",
  "east",
  "west",
  "city",
  "hall",
  "mall",
  "center",
  "hospital",
  "medical",
  "university",
  "market",
  "road",
  "avenue",
  "street",
]);

/** Brand/place prefixes locals glue to the next word: "smnorth", "qchall". */
const GLUED_PREFIXES = ["sm", "up", "st", "brgy", "qc", "tri"];

/** Split only a glued token whose prefix is shorthand and whose rest looks like a word. */
export function splitGluedShorthand(query: string): string {
  return query
    .split(/\s+/)
    .flatMap((word) => {
      const lower = word.toLowerCase();
      const prefix = GLUED_PREFIXES.find((candidate) => lower.startsWith(candidate));
      if (!prefix || PLACE_WORDS.has(lower) || word.length <= prefix.length + 2) return [word];
      return [prefix, word.slice(prefix.length)];
    })
    .join(" ");
}

/** Fix a one-letter typo when the word is a known local place word. */
export function correctPlaceTypos(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const token = searchTokens(word)[0];
      if (!token || token.length < 5 || PLACE_WORDS.has(token)) return word;
      for (const known of PLACE_WORDS) {
        if (known.length >= 5 && hasOneTypo(token, known)) return known;
      }
      return word;
    })
    .join(" ");
}

/** Same token the Mapbox map itself renders with (a public pk token). */
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

function mapboxCategory(placeTypes: string[], category: string): PlaceCategory {
  const cat = category.toLowerCase();
  if (/mall|shopping|supermarket|department store|market/.test(cat)) return "mall";
  if (/hospital|clinic|medical|pharmacy/.test(cat)) return "hospital";
  if (/university|college|school/.test(cat)) return "university";
  if (/government|city hall|police|fire station|courthouse/.test(cat)) return "government";
  if (/station|transit|bus|railway|airport/.test(cat)) return "transit";
  if (/park|monument|stadium|museum|tourist|attraction|landmark/.test(cat)) return "landmark";
  if (placeTypes.includes("poi")) return "commercial";
  return "address";
}

type MapboxFeature = {
  id?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
  center?: [number, number];
  properties?: { category?: string };
  context?: { id?: string; text?: string }[];
};

/**
 * Place and address autocomplete via the Mapbox Geocoding API (the same
 * provider as the basemap and dry-state directions). Includes POIs -- malls,
 * hospitals, terminals -- inside the Metro Manila bbox, ranked by relevance
 * around `proximity`.
 */
export async function searchMapbox(
  query: string,
  proximity: LatLng | null,
  signal?: AbortSignal,
  token: string = MAPBOX_TOKEN,
): Promise<GeocodeResult[]> {
  const trimmed = normalizeSearchQuery(query);
  if (trimmed.length < MIN_QUERY_LENGTH || !token) return [];

  const params = new URLSearchParams({
    access_token: token,
    autocomplete: "true",
    limit: "10",
    country: "ph",
    language: "en",
    bbox: "120.90,14.35,121.15,14.78",
    types: "poi,address,neighborhood,locality,place",
  });
  if (proximity) params.set("proximity", `${proximity.longitude},${proximity.latitude}`);

  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?${params.toString()}`,
    { signal },
  );
  if (!response.ok) return [];

  const payload = (await response.json()) as { features?: MapboxFeature[] };
  
  return (payload.features ?? [])
    .map((feature) => {
      const [longitude, latitude] = feature.center ?? [NaN, NaN];
      const name = (feature.text ?? "").trim() || (feature.place_name ?? "").split(",")[0]?.trim();
      // place_name is "Name, street, district, city, country"; show a fuller
      // address (like a dropped pin resolves to) so results are easy to tell apart.
      const parts = (feature.place_name ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && part !== "Philippines");
      const rest = parts.filter((part) => part !== name);
      const subtitle = rest.join(", ") || parts.slice(1).join(", ") || "Address";
      return {
        id: feature.id ? `mapbox-${feature.id}` : undefined,
        name: name || "Location",
        label: feature.place_name?.trim() || name || "Location",
        subtitle,
        category: mapboxCategory(feature.place_type ?? [], feature.properties?.category ?? ""),
        latitude,
        longitude,
      };
    })
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}

/**
 * Reverse geocoding for a dropped pin: the same Mapbox endpoint as
 * `searchMapbox`, queried by coordinate instead of text (the v5 API
 * supports both at the same URL shape). Returns `null` on any failure or
 * without a token, so a dropped pin still gets a route -- just a plainer
 * "Dropped pin" label instead of a resolved place name.
 */
export async function reverseGeocodeName(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
  token: string = MAPBOX_TOKEN,
): Promise<string | null> {
  if (!token) return null;
  const params = new URLSearchParams({
    access_token: token,
    limit: "1",
    language: "en",
    types: "poi,address,place",
  });
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${params.toString()}`,
      { signal },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { features?: MapboxFeature[] };
    const feature = payload.features?.[0];
    if (!feature) return null;
    const full = (feature.place_name ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && part !== "Philippines")
      .join(", ");
    return full || (feature.text ?? "").trim() || null;
  } catch {
    return null;
  }
}

/** Best-effort barangay name from reverse geocode; null when unavailable. */
export async function reverseGeocodeBarangay(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
  token: string = MAPBOX_TOKEN,
): Promise<string | null> {
  if (!token) return null;
  const params = new URLSearchParams({
    access_token: token,
    limit: "1",
    language: "en",
    types: "neighborhood,locality,place",
  });
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${params.toString()}`,
      { signal },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { features?: MapboxFeature[] };
    const feature = payload.features?.[0];
    if (!feature) return null;
    const type = feature.place_type?.[0];
    if (type === "neighborhood" || type === "locality") {
      const name = (feature.text ?? "").trim();
      return name || null;
    }
    const ctx = feature.context?.find(
      (c) => c.id?.startsWith("neighborhood.") || c.id?.startsWith("locality."),
    );
    const name = (ctx?.text ?? "").trim();
    return name || null;
  } catch {
    return null;
  }
}

/**
 * Reverse geocoding for a city/locality label only (e.g. "Pasig"), for
 * display next to current conditions -- never the full street address a
 * dropped pin or report needs. Same endpoint as `reverseGeocodeName`, just
 * fenced to `place`-type features and returning the feature's own short name.
 */
export async function reverseGeocodeCity(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
  token: string = MAPBOX_TOKEN,
): Promise<string | null> {
  if (!token) return null;
  const params = new URLSearchParams({
    access_token: token,
    limit: "1",
    language: "en",
    types: "place",
  });
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${params.toString()}`,
      { signal },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { features?: MapboxFeature[] };
    return (payload.features?.[0]?.text ?? "").trim() || null;
  } catch {
    return null;
  }
}

/**
 * Free-text address and establishment search via Nominatim (OSM's own geocoder),
 * bounded to Metro Manila so the fallback cannot drift outside the pilot area.
 * Address details separate the place name from its road/barangay/city subtitle.
 */
export async function searchAddress(
  query: string,
  box: BoundingBox = METRO_MANILA_BOX,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const trimmed = normalizeSearchQuery(query);
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: "5",
    viewbox: `${box.west.toFixed(2)},${box.north.toFixed(2)},${box.east.toFixed(2)},${box.south.toFixed(2)}`,
    bounded: "1",
    addressdetails: "1",
    countrycodes: "ph",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    signal,
    headers: { "User-Agent": "MetroFlow flood-aware navigation pilot" },
  });
  if (!response.ok) return [];

  const rows = (await response.json()) as {
    place_id?: number | string;
    name?: string;
    display_name: string;
    category?: string;
    type?: string;
    lat: string;
    lon: string;
    address?: NominatimAddress;
  }[];

  return rows
    .map((row) => {
      const name = cleanEstablishmentName(row.name, row.display_name);
      const subtitle = formatSubtitle(row.address, row.display_name);
      const category = inferCategory(row.category, row.type);
      return {
        id: row.place_id ? `osm-${row.place_id}` : undefined,
        name,
        label: name,
        subtitle,
        category,
        latitude: Number(row.lat),
        longitude: Number(row.lon),
      };
    })
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}

/** Tier results can overlap: same name, or essentially the same coordinates. */
function mergeUnique(places: GeocodeResult[]): GeocodeResult[] {
  const merged: GeocodeResult[] = [];
  for (const place of places) {
    const duplicate = merged.some(
      (other) =>
        other.name.toLowerCase() === place.name.toLowerCase() ||
        Math.abs(other.latitude - place.latitude) + Math.abs(other.longitude - place.longitude) < 0.001,
    );
    if (!duplicate) merged.push(place);
  }
  return merged;
}

function distanceTo(place: GeocodeResult, point: LatLng): number {
  return Math.abs(place.latitude - point.latitude) + Math.abs(place.longitude - point.longitude);
}

/**
 * Unified place search: Mapbox inside Metro Manila (biased to the driver),
 * with OSM as a second live tier. OSM is consulted when Mapbox has no exact
 * name hit, so a fuzzy "Avenue Extension" cannot outrank the actual avenue.
 * Results are deduplicated, exact names ranked first, then the closest to
 * the driver.
 */
export async function searchPlaces(
  query: string,
  opts: { proximity?: LatLng | null; mapboxToken?: string } = {},
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const { proximity = null, mapboxToken = MAPBOX_TOKEN } = opts;
  const normalizedQuery = normalizeSearchQuery(query);
  // The geocoders know words, not glued shorthand or common misspellings.
  const providerQuery = correctPlaceTypos(normalizeSearchQuery(splitGluedShorthand(query)));
  const scores = new Map<GeocodeResult, number>();
  const scoreOf = (place: GeocodeResult) => {
    let score = scores.get(place);
    if (score === undefined) {
      score = searchScore(providerQuery, `${place.name} ${place.subtitle}`);
      scores.set(place, score);
    }
    return score;
  };
  // Autocomplete happily returns "Fall Street" for "hall": keep only results
  // that actually match the searched words before ranking them.
  const matchesQuery = (place: GeocodeResult) => scoreOf(place) > 0;
  const isExactName = (place: GeocodeResult) => place.name.toLowerCase() === normalizedQuery.toLowerCase();

  if (normalizedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }

  try {
    const mapboxResults = mapboxToken
      ? (await searchMapbox(providerQuery, proximity, signal, mapboxToken)).filter(matchesQuery)
      : [];
    // One bounded OSM request at most: only when Mapbox has no exact hit.
    const osmResults =
      mapboxResults.some(isExactName)
        ? []
        : (await searchAddress(providerQuery, METRO_MANILA_BOX, signal)).filter(matchesQuery);

    const merged = mergeUnique([...mapboxResults, ...osmResults]);
    merged.sort((a, b) => {
      const exact = Number(isExactName(b)) - Number(isExactName(a));
      return (
        scoreOf(b) - scoreOf(a) ||
        exact ||
        (proximity ? distanceTo(a, proximity) - distanceTo(b, proximity) : 0)
      );
    });
    return merged.slice(0, 8);
  } catch {
    // A failed or aborted search simply has nothing to show.
    return [];
  }
}
