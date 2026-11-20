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

export type CuratedPlace = {
  id: string;
  name: string;
  subtitle: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  aliases: string[];
};

/**
 * Curated directory of prominent establishments, landmarks, hospitals,
 * universities, and government hubs in Quezon City and the pilot corridor.
 * Provides instant, zero-latency, offline-capable results as the driver types.
 */
export const CURATED_PLACES: CuratedPlace[] = [
  // --- Malls & Commercial Centers ---
  {
    id: "curated-sm-north",
    name: "SM City North EDSA",
    subtitle: "North Ave cor. EDSA, Quezon City",
    category: "mall",
    latitude: 14.6565,
    longitude: 121.0286,
    aliases: ["sm north", "sm edsa", "sm north edsa", "north edsa", "sm"],
  },
  {
    id: "curated-trinoma",
    name: "TriNoma Mall",
    subtitle: "EDSA cor. North Ave, Quezon City",
    category: "mall",
    latitude: 14.6536,
    longitude: 121.0332,
    aliases: ["trinoma", "tri noma", "ayala trinoma"],
  },
  {
    id: "curated-vertis-north",
    name: "Ayala Malls Vertis North",
    subtitle: "North Ave, Diliman, Quezon City",
    category: "mall",
    latitude: 14.6508,
    longitude: 121.0384,
    aliases: ["vertis north", "vertis", "ayala vertis"],
  },
  {
    id: "curated-gateway-mall",
    name: "Gateway Mall",
    subtitle: "Araneta City, Cubao, Quezon City",
    category: "mall",
    latitude: 14.6221,
    longitude: 121.0531,
    aliases: ["gateway", "gateway mall", "araneta cubao mall"],
  },
  {
    id: "curated-ali-mall",
    name: "Ali Mall",
    subtitle: "Araneta City, Cubao, Quezon City",
    category: "mall",
    latitude: 14.62,
    longitude: 121.0558,
    aliases: ["ali mall", "alimall", "araneta ali mall"],
  },
  {
    id: "curated-robinsons-magnolia",
    name: "Robinsons Magnolia",
    subtitle: "Aurora Blvd, New Manila, Quezon City",
    category: "mall",
    latitude: 14.6148,
    longitude: 121.0337,
    aliases: ["robinsons magnolia", "rob magnolia", "magnolia"],
  },
  {
    id: "curated-fisher-mall",
    name: "Fisher Mall",
    subtitle: "Quezon Ave, Diliman, Quezon City",
    category: "mall",
    latitude: 14.6366,
    longitude: 121.0189,
    aliases: ["fisher mall", "fisher"],
  },
  {
    id: "curated-up-town-center",
    name: "UP Town Center",
    subtitle: "Katipunan Ave, Diliman, Quezon City",
    category: "mall",
    latitude: 14.6514,
    longitude: 121.0747,
    aliases: ["up town center", "uptc", "up town"],
  },
  {
    id: "curated-eastwood-mall",
    name: "Eastwood Mall",
    subtitle: "Eastwood City, Bagumbayan, Quezon City",
    category: "mall",
    latitude: 14.6106,
    longitude: 121.0805,
    aliases: ["eastwood mall", "eastwood", "eastwood city"],
  },
  {
    id: "curated-ayala-cloverleaf",
    name: "Ayala Malls Cloverleaf",
    subtitle: "A. Bonifacio Ave, Balingasa, Quezon City",
    category: "mall",
    latitude: 14.6582,
    longitude: 121.0039,
    aliases: ["cloverleaf", "ayala cloverleaf"],
  },
  {
    id: "curated-sm-fairview",
    name: "SM City Fairview",
    subtitle: "Quirino Hwy, Novaliches, Quezon City",
    category: "mall",
    latitude: 14.7337,
    longitude: 121.0578,
    aliases: ["sm fairview", "fairview mall"],
  },
  {
    id: "curated-robinsons-galleria",
    name: "Robinsons Galleria",
    subtitle: "EDSA cor. Ortigas Ave, Quezon City",
    category: "mall",
    latitude: 14.5906,
    longitude: 121.0594,
    aliases: ["robinsons galleria", "rob galleria", "galleria"],
  },
  {
    id: "curated-sm-megamall",
    name: "SM Megamall",
    subtitle: "EDSA cor. Doña Julia Vargas, Mandaluyong",
    category: "mall",
    latitude: 14.5847,
    longitude: 121.0567,
    aliases: ["sm megamall", "megamall"],
  },

  // --- Hospitals & Healthcare ---
  {
    id: "curated-qc-gen-hospital",
    name: "Quezon City General Hospital",
    subtitle: "Seminary Rd, Project 8, Quezon City",
    category: "hospital",
    latitude: 14.6653,
    longitude: 121.0181,
    aliases: ["qcgh", "quezon city general hospital", "qc general"],
  },
  {
    id: "curated-st-lukes-qc",
    name: "St. Luke's Medical Center - Quezon City",
    subtitle: "E. Rodriguez Sr. Ave, New Manila, Quezon City",
    category: "hospital",
    latitude: 14.6227,
    longitude: 121.0232,
    aliases: ["st lukes", "st lukes qc", "saint lukes", "slmc qc", "st luke"],
  },
  {
    id: "curated-heart-center",
    name: "Philippine Heart Center",
    subtitle: "East Ave, Diliman, Quezon City",
    category: "hospital",
    latitude: 14.6433,
    longitude: 121.0475,
    aliases: ["philippine heart center", "heart center", "phc"],
  },
  {
    id: "curated-east-ave-medical",
    name: "East Avenue Medical Center",
    subtitle: "East Ave, Diliman, Quezon City",
    category: "hospital",
    latitude: 14.6405,
    longitude: 121.0496,
    aliases: ["east ave medical", "east avenue medical center", "eamc", "east ave hospital"],
  },
  {
    id: "curated-nkti",
    name: "National Kidney and Transplant Institute",
    subtitle: "East Ave, Diliman, Quezon City",
    category: "hospital",
    latitude: 14.6457,
    longitude: 121.0494,
    aliases: ["nkti", "kidney institute", "national kidney"],
  },
  {
    id: "curated-lung-center",
    name: "Lung Center of the Philippines",
    subtitle: "Quezon Ave, Diliman, Quezon City",
    category: "hospital",
    latitude: 14.6468,
    longitude: 121.0442,
    aliases: ["lung center", "lcp"],
  },
  {
    id: "curated-pcmc",
    name: "Philippine Children's Medical Center",
    subtitle: "Quezon Ave cor. Agham Rd, Quezon City",
    category: "hospital",
    latitude: 14.6461,
    longitude: 121.0401,
    aliases: ["pcmc", "childrens medical center", "philippine childrens"],
  },
  {
    id: "curated-veterans-hospital",
    name: "Veterans Memorial Medical Center",
    subtitle: "North Ave, Diliman, Quezon City",
    category: "hospital",
    latitude: 14.6596,
    longitude: 121.0416,
    aliases: ["veterans hospital", "veterans memorial", "vmmc"],
  },
  {
    id: "curated-capitol-medical",
    name: "Capitol Medical Center",
    subtitle: "Quezon Ave cor. Sct. Magbanua, Quezon City",
    category: "hospital",
    latitude: 14.6319,
    longitude: 121.0211,
    aliases: ["capitol medical center", "capitol medical", "cmc"],
  },
  {
    id: "curated-world-citi-med",
    name: "World Citi Medical Center",
    subtitle: "Aurora Blvd, Cubao, Quezon City",
    category: "hospital",
    latitude: 14.6256,
    longitude: 121.0664,
    aliases: ["world citi", "world citi med"],
  },
  {
    id: "curated-quirino-memorial",
    name: "Quirino Memorial Medical Center",
    subtitle: "Katipunan Ave, Project 4, Quezon City",
    category: "hospital",
    latitude: 14.6229,
    longitude: 121.0743,
    aliases: ["qmmc", "quirino medical", "quirino memorial"],
  },

  // --- Government & Civic Centers ---
  {
    id: "curated-qc-hall",
    name: "Quezon City Hall",
    subtitle: "Elliptical Rd, Diliman, Quezon City",
    category: "government",
    latitude: 14.6464,
    longitude: 121.05,
    aliases: ["qc hall", "city hall", "quezon city hall", "quezon hall"],
  },
  {
    id: "curated-batasan",
    name: "Batasang Pambansa Complex",
    subtitle: "Batasan Hills, Quezon City",
    category: "government",
    latitude: 14.6931,
    longitude: 121.095,
    aliases: ["batasan", "batasang pambansa", "house of representatives", "congress"],
  },
  {
    id: "curated-sss-main",
    name: "Social Security System (SSS) Main",
    subtitle: "East Ave, Diliman, Quezon City",
    category: "government",
    latitude: 14.6425,
    longitude: 121.046,
    aliases: ["sss main", "sss east ave", "social security system"],
  },
  {
    id: "curated-lto-central",
    name: "Land Transportation Office (LTO) Central",
    subtitle: "East Ave, Diliman, Quezon City",
    category: "government",
    latitude: 14.6401,
    longitude: 121.0435,
    aliases: ["lto central", "lto main", "lto east ave"],
  },
  {
    id: "curated-pagasa-office",
    name: "PAGASA Central Office",
    subtitle: "Agham Rd, Diliman, Quezon City",
    category: "government",
    latitude: 14.6439,
    longitude: 121.0437,
    aliases: ["pagasa", "pagasa office", "weather bureau"],
  },

  // --- Universities & Schools ---
  {
    id: "curated-up-diliman",
    name: "University of the Philippines Diliman",
    subtitle: "Diliman, Quezon City",
    category: "university",
    latitude: 14.6538,
    longitude: 121.0685,
    aliases: ["up diliman", "upd", "university of the philippines", "peyups", "up"],
  },
  {
    id: "curated-ateneo",
    name: "Ateneo de Manila University",
    subtitle: "Katipunan Ave, Loyola Heights, Quezon City",
    category: "university",
    latitude: 14.6397,
    longitude: 121.0778,
    aliases: ["ateneo", "admu", "ateneo de manila"],
  },
  {
    id: "curated-miriam-college",
    name: "Miriam College",
    subtitle: "Katipunan Ave, Loyola Heights, Quezon City",
    category: "university",
    latitude: 14.6442,
    longitude: 121.0772,
    aliases: ["miriam college", "miriam"],
  },
  {
    id: "curated-tip-qc",
    name: "Technological Institute of the Philippines QC",
    subtitle: "Aurora Blvd, Cubao, Quezon City",
    category: "university",
    latitude: 14.6247,
    longitude: 121.0669,
    aliases: ["tip qc", "tip cubao"],
  },

  // --- Landmarks & Recreation ---
  {
    id: "curated-qc-circle",
    name: "Quezon Memorial Circle",
    subtitle: "Elliptical Rd, Diliman, Quezon City",
    category: "landmark",
    latitude: 14.6517,
    longitude: 121.0493,
    aliases: ["qc circle", "quezon memorial circle", "circle", "quezon monument"],
  },
  {
    id: "curated-araneta-coliseum",
    name: "Smart Araneta Coliseum",
    subtitle: "Araneta City, Cubao, Quezon City",
    category: "landmark",
    latitude: 14.6204,
    longitude: 121.0528,
    aliases: ["araneta", "araneta coliseum", "big dome", "smart araneta"],
  },
  {
    id: "curated-ninoy-aquino-wildlife",
    name: "Ninoy Aquino Parks and Wildlife Center",
    subtitle: "Elliptical Rd, Diliman, Quezon City",
    category: "landmark",
    latitude: 14.6495,
    longitude: 121.0435,
    aliases: ["parks and wildlife", "ninoy aquino wildlife", "wildlife park"],
  },
  {
    id: "curated-amoranto-sports",
    name: "Amoranto Sports Complex",
    subtitle: "Roces Ave, Diliman, Quezon City",
    category: "landmark",
    latitude: 14.6347,
    longitude: 121.0094,
    aliases: ["amoranto", "amoranto stadium", "amoranto sports"],
  },
  {
    id: "curated-la-mesa-ecopark",
    name: "La Mesa Eco Park",
    subtitle: "Dunhill St, Fairview, Quezon City",
    category: "landmark",
    latitude: 14.7153,
    longitude: 121.0747,
    aliases: ["la mesa", "la mesa ecopark", "eco park"],
  },

  // --- Transit Terminals & Stations ---
  {
    id: "curated-mrt-north-ave",
    name: "MRT-3 North Avenue Station",
    subtitle: "EDSA cor. North Ave, Quezon City",
    category: "transit",
    latitude: 14.6528,
    longitude: 121.0322,
    aliases: ["mrt north", "mrt north ave", "north ave station"],
  },
  {
    id: "curated-mrt-quezon-ave",
    name: "MRT-3 Quezon Avenue Station",
    subtitle: "EDSA cor. Quezon Ave, Quezon City",
    category: "transit",
    latitude: 14.6427,
    longitude: 121.0383,
    aliases: ["mrt q ave", "mrt quezon ave", "quezon ave station"],
  },
  {
    id: "curated-mrt-cubao",
    name: "MRT-3 Araneta Center-Cubao Station",
    subtitle: "EDSA cor. Aurora Blvd, Cubao, Quezon City",
    category: "transit",
    latitude: 14.6196,
    longitude: 121.0514,
    aliases: ["mrt cubao", "cubao mrt", "araneta cubao station"],
  },
  {
    id: "curated-lrt-cubao",
    name: "LRT-2 Araneta Center-Cubao Station",
    subtitle: "Aurora Blvd, Cubao, Quezon City",
    category: "transit",
    latitude: 14.6225,
    longitude: 121.0536,
    aliases: ["lrt cubao", "cubao lrt"],
  },
  {
    id: "curated-lrt-katipunan",
    name: "LRT-2 Katipunan Station",
    subtitle: "Aurora Blvd cor. Katipunan Ave, Quezon City",
    category: "transit",
    latitude: 14.6315,
    longitude: 121.0728,
    aliases: ["lrt katipunan", "katipunan station"],
  },

  // --- Fallback & Corridor Connectors ---
  {
    id: "curated-ortigas-center",
    name: "Ortigas Center",
    subtitle: "Ortigas Ave, Pasig / Mandaluyong",
    category: "commercial",
    latitude: 14.5866,
    longitude: 121.0617,
    aliases: ["ortigas", "ortigas center"],
  },
  {
    id: "curated-medical-city-ortigas",
    name: "The Medical City Ortigas",
    subtitle: "Ortigas Ave, Pasig",
    category: "hospital",
    latitude: 14.5894,
    longitude: 121.0694,
    aliases: ["medical city", "tmc ortigas", "the medical city"],
  },
];

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

/** Check whether a point is inside a bounding box with a small buffer. */
export function isInsideBox(lat: number, lon: number, box: BoundingBox, bufferDeg = 0.05): boolean {
  return (
    lat >= box.south - bufferDeg &&
    lat <= box.north + bufferDeg &&
    lon >= box.west - bufferDeg &&
    lon <= box.east + bufferDeg
  );
}

/**
 * Instant local search through curated establishments and landmarks.
 * Matches against place name, subtitle, and popular aliases.
 */
export function searchCuratedPlaces(
  query: string,
  box?: BoundingBox | null,
  limit = 6,
): GeocodeResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const tokens = q.split(/\s+/).filter(Boolean);

  const matched = CURATED_PLACES.filter((place) => {
    if (box && !isInsideBox(place.latitude, place.longitude, box)) {
      return false;
    }
    const nameLower = place.name.toLowerCase();
    const subtitleLower = place.subtitle.toLowerCase();
    const matchesAllTokens = tokens.every(
      (tok) =>
        nameLower.includes(tok) ||
        subtitleLower.includes(tok) ||
        place.aliases.some((alias) => alias.toLowerCase().includes(tok)),
    );
    return matchesAllTokens;
  });

  return matched.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.name,
    label: p.name,
    subtitle: p.subtitle,
    category: p.category,
    latitude: p.latitude,
    longitude: p.longitude,
  }));
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
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
};

function formatSubtitle(address?: NominatimAddress, displayName?: string): string {
  if (address) {
    const primary = address.road || address.neighbourhood || address.suburb;
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
};

/**
 * Place and address autocomplete via the Mapbox Geocoding API (the same
 * provider as the basemap and dry-state directions). Unlike the Nominatim
 * fallback below this includes POIs -- malls, hospitals, terminals -- and
 * ranks by relevance around `proximity` instead of hard-filtering to a box,
 * which is how a general-purpose map app answers "Market Market" from
 * Quezon City with the Taguig mall, nearest first.
 */
export async function searchMapbox(
  query: string,
  proximity: LatLng | null,
  signal?: AbortSignal,
  token: string = MAPBOX_TOKEN,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH || !token) return [];

  const params = new URLSearchParams({
    access_token: token,
    autocomplete: "true",
    limit: "8",
    country: "ph",
    language: "en",
    types: "poi,address,place,locality,neighborhood",
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

/**
 * Free-text address and establishment search via Nominatim (OSM's own geocoder).
 * Request addressdetails to separate place name from street/city subtitle.
 * The viewbox is a ranking bias, not a fence: a result outside the pilot
 * network (a Taguig mall searched from Quezon City) is still a real
 * destination, so `bounded` stays off.
 */
export async function searchAddress(
  query: string,
  box: BoundingBox,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: "5",
    viewbox: `${box.west},${box.north},${box.east},${box.south}`,
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

/**
 * Unified place search: instant curated establishments first, then live
 * geocoding -- Mapbox (POIs, proximity-ranked, no geographic fence) when a
 * token is configured, Nominatim inside the network box otherwise.
 */
export async function searchPlaces(
  query: string,
  opts: { box?: BoundingBox | null; proximity?: LatLng | null; mapboxToken?: string } = {},
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const { box = null, proximity = null, mapboxToken = MAPBOX_TOKEN } = opts;
  const curated = searchCuratedPlaces(query, box, 5);

  if (query.trim().length < MIN_QUERY_LENGTH) {
    return curated;
  }

  try {
    const liveResults = mapboxToken
      ? await searchMapbox(query, proximity, signal, mapboxToken)
      : box
        ? await searchAddress(query, box, signal)
        : [];
    // Combine and deduplicate against curated results
    const combined = [...curated];
    for (const item of liveResults) {
      const alreadyPresent = combined.some((c) => {
        const nameMatch = c.name.toLowerCase() === item.name.toLowerCase();
        const distDiff =
          Math.abs(c.latitude - item.latitude) + Math.abs(c.longitude - item.longitude);
        return nameMatch || distDiff < 0.001; // ~100m
      });
      if (!alreadyPresent) {
        combined.push(item);
      }
    }
    return combined.slice(0, 8);
  } catch {
    return curated;
  }
}
