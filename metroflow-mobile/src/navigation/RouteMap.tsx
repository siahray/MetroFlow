import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon, Polyline, UrlTile, type Region } from "react-native-maps";

import type { EdgeFeature, HazardInfo, RoutePlan } from "../api";
import { polygonRing, routeCoordinates, type LatLng } from "./geo";
import { basemapFor } from "./tiles";

import { fontSize, space, useTheme, type ThemeColors } from "../theme";

export type RouteMapHandle = {
  /** Re-centres on the driver's own position, if known. */
  recenter: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

// Same status colours as the dispatcher portal's network map.
const STATUS_STYLE = {
  PASSABLE: { label: "Passable" },
  LIGHT_FLOOD: { label: "Light flood" },
  SUBMERGED: { label: "Submerged" },
} as const;
type StatusKey = keyof typeof STATUS_STYLE;
const STATUS_COLOR = (c: ThemeColors): Record<StatusKey, string> => ({
  PASSABLE: c.emerald600,
  LIGHT_FLOOD: c.amber600,
  SUBMERGED: c.rose600,
});

/** Flow label from real recorded speed vs. the road's posted limit — never a fabricated traffic feed. */
export function congestionFromSpeeds(
  avgKmh: number,
  maxKmh: number,
): { label: string; tone: "success" | "warning" | "danger" } {
  const ratio = maxKmh > 0 ? avgKmh / maxKmh : 1;
  if (ratio >= 0.8) return { label: "Flowing", tone: "success" };
  if (ratio >= 0.5) return { label: "Moderate", tone: "warning" };
  return { label: "Congested", tone: "danger" };
}

const TRAFFIC_STYLE = {
  success: { label: "Flowing" },
  warning: { label: "Moderate" },
  danger: { label: "Congested" },
} as const;
const TRAFFIC_COLOR = (c: ThemeColors): Record<"success" | "warning" | "danger", string> => ({
  success: c.green600,
  warning: c.amber600,
  danger: c.red600,
});

/** Flood passability only, traffic flow only, or flood status with traffic as the fallback
 * for passable roads (flood safety is the more critical signal, so it always wins). */
export type MapViewMode = "passability" | "traffic" | "both";

type MapHazard = Pick<HazardInfo, "hazard_id" | "name" | "obstruction_level" | "geometry">;

type Props = {
  route: RoutePlan | null;
  position: LatLng | null;
  destination: LatLng | null;
  destinationName: string | null;
  hazards: MapHazard[];
  edges?: EdgeFeature[];
  /** The driver's own vehicle clearance, for the flood-depth marker labels (safe vs. exceeds). */
  clearanceCm?: number;
  viewMode?: MapViewMode;
};

function blocking(level: string) {
  return ["LEVEL_2", "LEVEL_3", "IMPASSABLE"].includes(level.toUpperCase());
}

function midpoint(coords: [number, number][]): LatLng | null {
  if (coords.length === 0) return null;
  const [lon, lat] = coords[Math.floor(coords.length / 2)];
  return { latitude: lat, longitude: lon };
}

function regionFor(coordinates: LatLng[], fallback: LatLng | null): Region | null {
  if (coordinates.length === 0) {
    return fallback ? { ...fallback, latitudeDelta: 0.02, longitudeDelta: 0.02 } : null;
  }

  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.012),
    longitudeDelta: Math.max((maxLon - minLon) * 1.5, 0.012),
  };
}

export const RouteMap = forwardRef<RouteMapHandle, Props>(function RouteMap({
  route,
  position,
  destination,
  destinationName,
  hazards,
  edges = [],
  clearanceCm,
  viewMode = "passability",
}, ref) {
  const { c, mode } = useTheme();
  const basemap = basemapFor(mode);
  const styles = useMemo(() => makeStyles(c, mode), [c, mode]);
  const statusColor = useMemo(() => STATUS_COLOR(c), [c]);
  const trafficColor = useMemo(() => TRAFFIC_COLOR(c), [c]);
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    recenter: () => {
      if (position) mapRef.current?.animateCamera({ center: position }, { duration: 300 });
    },
    zoomIn: () => {
      void mapRef.current
        ?.getCamera()
        .then((cam) => mapRef.current?.animateCamera({ ...cam, zoom: (cam.zoom ?? 15) + 1 }, { duration: 200 }));
    },
    zoomOut: () => {
      void mapRef.current
        ?.getCamera()
        .then((cam) => mapRef.current?.animateCamera({ ...cam, zoom: (cam.zoom ?? 15) - 1 }, { duration: 200 }));
    },
  }));

  // A route determines the framing; between routes the map follows the driver.
  // Computing it during render avoids a state round-trip that would otherwise
  // animate the camera twice for every plan.
  const routeRegion = useMemo(
    () => (route ? regionFor(routeCoordinates(route), null) : null),
    [route],
  );
  const roads = useMemo(
    () =>
      edges.map((edge) => {
        const traffic = congestionFromSpeeds(edge.properties.avg_speed_kmh, edge.properties.max_speed_kmh);
        const floodColor = statusColor[edge.properties.status as StatusKey] ?? c.slate600;
        const color =
          viewMode === "traffic"
            ? trafficColor[traffic.tone]
            : viewMode === "both" && edge.properties.status === "PASSABLE"
              ? trafficColor[traffic.tone]
              : floodColor;
        return {
          id: edge.properties.edge_id,
          color,
          points: edge.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
        };
      }),
    [edges, viewMode, statusColor, trafficColor, c.slate600],
  );
  // With no fix and no route, frame the whole road network instead of leaving the map blank.
  const idleRegion = useMemo(
    () => (position ? regionFor([], position) : regionFor(roads.flatMap((r) => r.points), null)),
    [position, roads],
  );
  const region = routeRegion ?? idleRegion;

  const line = route ? routeCoordinates(route) : [];

  // Depth-callout pills for flagged segments only (PASSABLE roads need no label).
  const depthMarkers = useMemo(
    () =>
      edges
        .filter((edge) => edge.properties.status !== "PASSABLE")
        .map((edge) => ({
          id: edge.properties.edge_id,
          point: midpoint(edge.geometry.coordinates),
          depthCm: edge.properties.water_depth_cm,
          safe: clearanceCm === undefined || edge.properties.water_depth_cm <= clearanceCm,
        }))
        .filter((m): m is typeof m & { point: LatLng } => m.point !== null),
    [edges, clearanceCm],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        region={region ?? undefined}
        showsUserLocation={false}
        toolbarEnabled={false}
        // The basemap comes from our own raster tiles, not Google's.
        mapType="none"
      >
        {/* Keyed by template so flipping the theme rebuilds the tile layer. */}
        <UrlTile
          key={basemap.urlTemplate}
          urlTemplate={basemap.urlTemplate}
          maximumZ={basemap.maximumZ}
          tileSize={256}
          zIndex={-1}
        />

        {roads.map((road) => (
          <Polyline
            key={road.id}
            coordinates={road.points}
            strokeColor={road.color}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {line.length > 1 ? (
          <Polyline
            coordinates={line}
            strokeColor={c.blue600}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {hazards.map((hazard) => {
          const ring = polygonRing(hazard.geometry);
          if (ring.length < 3) return null;
          const closed = blocking(hazard.obstruction_level);
          return (
            <Polygon
              key={hazard.hazard_id}
              coordinates={ring}
              fillColor={closed ? "rgba(220,38,38,0.25)" : "rgba(245,158,11,0.22)"}
              strokeColor={closed ? c.red600 : c.amber500}
              strokeWidth={2}
            />
          );
        })}

        {depthMarkers.map((marker) => (
          <Marker key={marker.id} coordinate={marker.point} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.depthPill, { borderColor: marker.safe ? c.blue500 : c.red600 }]}>
              <Text style={[styles.depthPillText, { color: marker.safe ? c.blue700 : c.red700 }]}>
                {marker.depthCm} cm {marker.safe ? "· Safe" : "Water"}
              </Text>
            </View>
          </Marker>
        ))}

        {position ? (
          <Marker
            coordinate={position}
            title="Your location"
            pinColor={c.blue600}
            tracksViewChanges={false}
          />
        ) : null}

        {destination ? (
          <Marker
            coordinate={destination}
            title={destinationName ?? "Destination"}
            pinColor={c.red600}
            tracksViewChanges={false}
          />
        ) : null}
      </MapView>
      {roads.length > 0 ? (
        <View style={styles.legend}>
          {viewMode !== "traffic"
            ? Object.entries(STATUS_STYLE).map(([key, item]) => (
                <View key={item.label} style={styles.legendRow}>
                  <View style={[styles.swatch, { backgroundColor: statusColor[key as StatusKey] }]} />
                  <Text style={styles.legendText}>{item.label}</Text>
                </View>
              ))
            : null}
          {viewMode !== "passability"
            ? Object.entries(TRAFFIC_STYLE).map(([key, item]) => (
                <View key={item.label} style={styles.legendRow}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: trafficColor[key as keyof typeof TRAFFIC_STYLE] },
                    ]}
                  />
                  <Text style={styles.legendText}>
                    {item.label}
                    {viewMode === "both" ? " (clear roads)" : ""}
                  </Text>
                </View>
              ))
            : null}
        </View>
      ) : null}
      <Text style={styles.attribution}>{basemap.attribution}</Text>
    </View>
  );
});

function makeStyles(c: ThemeColors, mode: "light" | "storm") {
  const chromeBg = mode === "storm" ? "rgba(11,18,32,0.88)" : "rgba(255,255,255,0.92)";
  return StyleSheet.create({
    container: { flex: 1, overflow: "hidden", backgroundColor: c.slate200 },
    legend: {
      position: "absolute",
      left: 8,
      bottom: 22,
      backgroundColor: chromeBg,
      borderRadius: 8,
      paddingHorizontal: space[8],
      paddingVertical: space[6],
      gap: space[3],
    },
    legendRow: { flexDirection: "row", alignItems: "center", gap: space[6] },
    swatch: { width: 14, height: 4, borderRadius: 2 },
    legendText: { fontSize: fontSize.micro, color: c.slate600 },
    depthPill: {
      backgroundColor: chromeBg,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: space[8],
      paddingVertical: space[3],
    },
    depthPillText: { fontSize: fontSize.tiny, fontWeight: "700" },
    attribution: {
      position: "absolute",
      right: 6,
      bottom: 4,
      fontSize: fontSize.tiny,
      color: c.slate600,
      backgroundColor: chromeBg,
      paddingHorizontal: space[4],
      borderRadius: 3,
    },
  });
}
