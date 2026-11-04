/**
 * Geospatial distance and ETA calculations for the MetroFlow LGU portal.
 */

/** Radius of the Earth in kilometers. */
const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two coordinates in kilometers (Haversine formula).
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export type NearestUnitResult = {
  callSign: string;
  type: string;
  distanceKm: number;
  etaMinutes: number;
  status: string;
};

/**
 * Finds the nearest rescue vehicle from a target location and estimates ETA.
 */
export function findNearestUnit(
  targetLat: number,
  targetLon: number,
  vehicles: Array<{
    call_sign: string;
    vehicle_type: string;
    status: string;
    current_location_lat?: number | null;
    current_location_lon?: number | null;
    speed_kmh?: number | null;
  }>,
): NearestUnitResult | null {
  if (!vehicles || vehicles.length === 0) return null;

  let best: NearestUnitResult | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const v of vehicles) {
    // A unit that never reported a position cannot be ranked: assuming a depot
    // would put a unit on the map that is not there.
    if (v.current_location_lat == null || v.current_location_lon == null) continue;
    const dist = haversineDistanceKm(
      targetLat,
      targetLon,
      v.current_location_lat,
      v.current_location_lon,
    );

    if (dist < minDistance) {
      minDistance = dist;
      // shortcut: vehicles without a reported speed use 30 km/h, so the ETA is an
      // approximation until the fleet reports speed.
      const speed = v.speed_kmh && v.speed_kmh > 5 ? v.speed_kmh : 30;
      const eta = Math.max(1, Math.round((dist / speed) * 60));
      best = {
        callSign: v.call_sign,
        type: v.vehicle_type,
        distanceKm: Math.round(dist * 10) / 10,
        etaMinutes: eta,
        status: v.status,
      };
    }
  }

  return best;
}
