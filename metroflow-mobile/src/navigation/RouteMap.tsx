import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon, Polyline, UrlTile, type Region } from "react-native-maps";

import type { EdgeFeature, HazardInfo, RoutePlan } from "../api";
import { polygonRing, routeCoordinates, type LatLng } from "./geo";
import { basemap } from "./tiles";

import { fontSize, space, useTheme, type ThemeColors } from "../theme";

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

type MapHazard = Pick<HazardInfo, "hazard_id" | "name" | "obstruction_level" | "geometry">;

type Props = {
  route: RoutePlan | null;
  position: LatLng | null;
  destination: LatLng | null;
  destinationName: string | null;
  hazards: MapHazard[];
  edges?: EdgeFeature[];
};

function blocking(level: string) {
  return ["LEVEL_2", "LEVEL_3", "IMPASSABLE"].includes(level.toUpperCase());
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

export function RouteMap({
  route,
  position,
  destination,
  destinationName,
  hazards,
  edges = [],
}: Props) {
  const { c, mode } = useTheme();
  const styles = useMemo(() => makeStyles(c, mode), [c, mode]);
  const statusColor = useMemo(() => STATUS_COLOR(c), [c]);

  // A route determines the framing; between routes the map follows the driver.
  // Computing it during render avoids a state round-trip that would otherwise
  // animate the camera twice for every plan.
  const routeRegion = useMemo(
    () => (route ? regionFor(routeCoordinates(route), null) : null),
    [route],
  );
  const roads = useMemo(
    () =>
      edges.map((edge) => ({
        id: edge.properties.edge_id,
        status: edge.properties.status,
        points: edge.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
      })),
    [edges],
  );
  // With no fix and no route, frame the whole road network instead of leaving the map blank.
  const idleRegion = useMemo(
    () => (position ? regionFor([], position) : regionFor(roads.flatMap((r) => r.points), null)),
    [position, roads],
  );
  const region = routeRegion ?? idleRegion;

  const line = route ? routeCoordinates(route) : [];

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={region ?? undefined}
        showsUserLocation={false}
        toolbarEnabled={false}
        // The basemap comes from our own raster tiles, not Google's.
        mapType="none"
      >
        <UrlTile urlTemplate={basemap.urlTemplate} maximumZ={basemap.maximumZ} tileSize={256} zIndex={-1} />

        {roads.map((road) => (
          <Polyline
            key={road.id}
            coordinates={road.points}
            strokeColor={statusColor[road.status as StatusKey] ?? c.slate600}
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
          {Object.entries(STATUS_STYLE).map(([key, item]) => (
            <View key={item.label} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: statusColor[key as StatusKey] }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.attribution}>{basemap.attribution}</Text>
    </View>
  );
}

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
