import type { LatLng } from "./navigation/geo";

/**
 * Free-text address search via Nominatim (OSM's own geocoder) -- free and
 * keyless like the project's other open-data sources (CR-004's Open-Meteo),
 * restricted to a bounding box so results stay relevant to the pilot
 * corridor instead of matching a same-named street anywhere on Earth.
 *
 * Subject to Nominatim's usage policy: at most ~1 request/second and no bulk
 * use; the caller debounces well under that. The policy also asks for an
 * identifying User-Agent, set below, though some mobile networking stacks
 * silently drop a manually-set User-Agent header -- there is no client-side
 * way around that.
 */

export type GeocodeResult = {
  label: string;
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

const MIN_QUERY_LENGTH = 3;

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
    // Nominatim's own corner order: left,top,right,bottom (lon,lat pairs).
    viewbox: `${box.west},${box.north},${box.east},${box.south}`,
    bounded: "1",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    signal,
    headers: { "User-Agent": "MetroFlow flood-aware navigation pilot" },
  });
  if (!response.ok) return [];

  const rows = (await response.json()) as { display_name: string; lat: string; lon: string }[];
  return rows
    .map((row) => ({
      label: row.display_name,
      latitude: Number(row.lat),
      longitude: Number(row.lon),
    }))
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}
