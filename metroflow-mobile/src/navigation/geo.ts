import type { GeoJsonPolygon, NodeFeature, RouteInstruction, RoutePlan } from "../api";

export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6_371_000;
const METRES_PER_DEGREE_LAT = 110_540;
const METRES_PER_DEGREE_LON_AT_EQUATOR = 111_320;

export function toLatLng(coordinates: [number, number]): LatLng {
  // The API speaks GeoJSON: [longitude, latitude].
  return { latitude: coordinates[1], longitude: coordinates[0] };
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Metres-per-degree scaling for the small distances a driver screen cares about. */
function metresPerDegree(latitude: number) {
  return {
    lon: METRES_PER_DEGREE_LON_AT_EQUATOR * Math.cos((latitude * Math.PI) / 180),
    lat: METRES_PER_DEGREE_LAT,
  };
}

export function nearestNode(nodes: NodeFeature[], point: LatLng): NodeFeature | null {
  let best: NodeFeature | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const candidate = toLatLng(node.geometry.coordinates);
    const distance = distanceMeters(point, candidate);
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}

export function routeCoordinates(route: RoutePlan): LatLng[] {
  return route.geometry.coordinates.map(toLatLng);
}

/**
 * Distance from a point to a segment, in metres, and where on the segment it
 * falls (`t` in 0..1). A local equirectangular projection is accurate to a few
 * centimetres over a city block, which is all a proximity alert needs.
 */
function projectOnSegment(point: LatLng, start: LatLng, end: LatLng) {
  const scale = metresPerDegree((start.latitude + end.latitude + point.latitude) / 3);
  const px = (point.longitude - start.longitude) * scale.lon;
  const py = (point.latitude - start.latitude) * scale.lat;
  const bx = (end.longitude - start.longitude) * scale.lon;
  const by = (end.latitude - start.latitude) * scale.lat;
  const lengthSquared = bx * bx + by * by;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared));
  return {
    t,
    distance: Math.hypot(px - t * bx, py - t * by),
    length: Math.sqrt(lengthSquared),
  };
}

/**
 * How far along the route the driver is, and how far they are from the line.
 * Following the polyline rather than the straight line to the destination is
 * what lets the banner count down real remaining distance.
 */
export function progressAlongRoute(
  coordinates: LatLng[],
  point: LatLng,
): { progressM: number; distanceToRouteM: number; totalM: number } {
  if (coordinates.length < 2) {
    const fallback = coordinates[0];
    return {
      progressM: 0,
      distanceToRouteM: fallback ? distanceMeters(point, fallback) : Number.POSITIVE_INFINITY,
      totalM: 0,
    };
  }

  let accumulated = 0;
  let best = {
    progressM: 0,
    distanceToRouteM: Number.POSITIVE_INFINITY,
    totalM: 0,
  };

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const projection = projectOnSegment(point, start, end);
    if (projection.distance < best.distanceToRouteM) {
      best = {
        progressM: accumulated + projection.t * projection.length,
        distanceToRouteM: projection.distance,
        totalM: accumulated + projection.length,
      };
    }
    accumulated += projection.length;
  }

  return { ...best, totalM: accumulated };
}

/** Index of the instruction the driver is currently on. */
export function instructionIndexForProgress(
  instructions: RouteInstruction[],
  progressM: number,
): number {
  let boundary = 0;
  for (let index = 0; index < instructions.length; index += 1) {
    const step = instructions[index];
    if (step.manoeuvre === "ARRIVE") return index;
    boundary += step.distance_m;
    if (progressM < boundary) return index;
  }
  return Math.max(0, instructions.length - 1);
}

/** Remaining distance on the current instruction, clamped at zero. */
export function remainingOnStep(instructions: RouteInstruction[], index: number, progressM: number) {
  let boundary = 0;
  for (let cursor = 0; cursor <= index && cursor < instructions.length; cursor += 1) {
    boundary += instructions[cursor].distance_m;
  }
  return Math.max(0, boundary - progressM);
}

export function polygonRing(geometry: GeoJsonPolygon | null): LatLng[] {
  const ring = geometry?.coordinates?.[0];
  return ring ? ring.map(toLatLng) : [];
}

/** Shortest distance from the driver to a hazard polygon, in metres. */
export function distanceToPolygonMeters(point: LatLng, ring: LatLng[]): number {
  if (ring.length === 0) return Number.POSITIVE_INFINITY;
  if (ring.length === 1) return distanceMeters(point, ring[0]);

  let shortest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    shortest = Math.min(shortest, projectOnSegment(point, start, end).distance);
  }
  return shortest;
}

export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return "";
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  return `${Math.round(minutes)} min`;
}
