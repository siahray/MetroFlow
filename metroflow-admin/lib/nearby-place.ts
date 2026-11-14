/**
 * Reverse-geocode a coordinate to the nearest named place/establishment, for
 * an incident panel that only has raw lat/lon otherwise. Nominatim (OSM's
 * own geocoder): free, keyless, same provider the driver app's address
 * search already uses -- no new secret or dependency for the admin portal.
 */

export type NearbyPlace = {
  name: string;
  address: string;
};

function cleanName(rawName: string | undefined, displayName: string): string {
  if (rawName && rawName.trim().length > 0) return rawName.trim();
  return displayName.split(",")[0]?.trim() || displayName;
}

export async function nearbyPlace(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<NearbyPlace | null> {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    signal,
    headers: { "User-Agent": "MetroFlow LGU dispatch portal" },
  });
  if (!response.ok) return null;

  const row = (await response.json()) as {
    name?: string;
    display_name?: string;
    address?: Record<string, string>;
  };
  if (!row.display_name) return null;

  const parts = row.display_name
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    name: cleanName(row.name, row.display_name),
    address: parts.slice(1, 3).join(", ") || row.display_name,
  };
}
