import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon, Polyline, type Region } from "react-native-maps";

import type { EdgeFeature, HazardInfo, RoutePlan } from "../api";
import { polygonRing, routeCoordinates, type LatLng } from "./geo";

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
 * for passable roads (flood safety is the more critical signal, so it always wins).
 * ``traffic`` is the normal-map view: congestion only, with no flood overlay. */
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

  // A loop, not Math.min(...points): the real OSM network has far more points
  // than a spread call can take on the JS stack.
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const point of coordinates) {
    if (point.latitude < minLat) minLat = point.latitude;
    if (point.latitude > maxLat) maxLat = point.latitude;
    if (point.longitude < minLon) minLon = point.longitude;
    if (point.longitude > maxLon) maxLon = point.longitude;
  }
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
  }), [position]);

  // The route bounds frame the map when a plan exists.
  const routeRegion = useMemo(
    () => (route ? regionFor(routeCoordinates(route), null) : null),
    [route],
  );
  const roads = useMemo(
    () =>
      edges.map((edge) => {
        const traffic = congestionFromSpeeds(edge.properties.avg_speed_kmh, edge.properties.max_speed_kmh);
        const flooded = edge.properties.status !== "PASSABLE";
        const congested = traffic.tone !== "success";
        // The basemap already draws every road, so only a segment that differs
        // from it gets an overlay. Painting all ~11k passable ones is what made
        // panning and first load stutter.
        const painted =
          viewMode === "traffic" ? congested : viewMode === "both" ? flooded || congested : flooded;
        return {
          id: edge.properties.edge_id,
          painted,
          color:
            viewMode === "traffic" || (viewMode === "both" && !flooded)
              ? trafficColor[traffic.tone]
              : (statusColor[edge.properties.status as StatusKey] ?? c.slate600),
          points: edge.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
        };
      }),
    [edges, viewMode, statusColor, trafficColor, c.slate600],
  );
  // With no fix and no route, frame the whole road network instead of leaving the map blank.
  const networkRegion = useMemo(() => regionFor(roads.flatMap((r) => r.points), null), [roads]);
  // The camera is framed once, then left alone. A controlled `region` prop would
  // re-apply on every GPS tick and yank the map back, fighting the driver's panning.
  const [initialRegion] = useState<Region | undefined>(
    () => routeRegion ?? (position ? regionFor([], position) : undefined) ?? undefined,
  );
  const framed = useRef(initialRegion !== undefined);
  useEffect(() => {
    // A newly planned route is the one thing that always re-frames the map.
    if (routeRegion) {
      framed.current = true;
      mapRef.current?.animateToRegion(routeRegion, 500);
      return;
    }
    if (framed.current) return;
    const target = position ? regionFor([], position) : networkRegion;
    if (!target) return;
    framed.current = true;
    mapRef.current?.animateToRegion(target, 0);
  }, [routeRegion, networkRegion, position]);

  // Rebuilt only when the plan changes: the route line is the most visible thing
  // on screen, so it must not be re-derived on every GPS tick.
  const routeLine = useMemo(() => (route ? routeCoordinates(route) : []), [route]);

  // Built once per road set. Only the deviating segments become overlays, so a
  // dry network is a handful of polylines instead of ~11k.
  const roadLines = useMemo(
    () =>
      roads
        .filter((road) => road.painted)
        .map((road) => (
          <Polyline
            key={road.id}
            coordinates={road.points}
            strokeColor={road.color}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
          />
        )),
    [roads],
  );

  // Hazard outlines, rebuilt only when the hazard set changes rather than on
  // every GPS tick.
  const hazardShapes = useMemo(
    () =>
      hazards.map((hazard) => {
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
      }),
    [hazards, c.red600, c.amber500],
  );

  // Depth-callout pills for flagged segments only (PASSABLE roads need no label).
  // Built as elements, not data: a custom-view Marker with tracksViewChanges on
  // re-snapshots itself continuously, which is the classic map-jank cause.
  const depthPills = useMemo(
    () =>
      edges
        .filter((edge) => edge.properties.status !== "PASSABLE")
        .map((edge) => {
          const point = midpoint(edge.geometry.coordinates);
          if (!point) return null;
          const safe = clearanceCm === undefined || edge.properties.water_depth_cm <= clearanceCm;
          return (
            <Marker
              key={edge.properties.edge_id}
              coordinate={point}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={[styles.depthPill, { borderColor: safe ? c.blue500 : c.red600 }]}>
                <Text style={[styles.depthPillText, { color: safe ? c.blue700 : c.red700 }]}>
                  {edge.properties.water_depth_cm} cm {safe ? "· Safe" : "Water"}
                </Text>
              </View>
            </Marker>
          );
        }),
    [edges, clearanceCm, styles, c.blue500, c.blue700, c.red600, c.red700],
  );

  // The normal-map view is congestion only: no flood polygons, no depth pills.
  const floodOverlay = viewMode !== "traffic";

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        toolbarEnabled={false}
      >
        {roadLines}

        {routeLine.length > 1 ? (
          <>
            {/* White casing under the blue line: the Google-Maps route look. */}
            <Polyline
              coordinates={routeLine}
              strokeColor="#ffffff"
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={routeLine}
              strokeColor={c.blue600}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          </>
        ) : null}

        {floodOverlay ? hazardShapes : null}

        {floodOverlay ? depthPills : null}

        {position ? (
          <Marker
            coordinate={position}
            title="Your location"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            {/* The blue "you are here" dot, not a pin. */}
            <View style={styles.meHalo}>
              <View style={[styles.meDot, { backgroundColor: c.blue600 }]} />
            </View>
          </Marker>
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
      {roadLines.length > 0 ? (
        <View style={styles.legend}>
          {viewMode !== "traffic"
            ? Object.entries(STATUS_STYLE)
                .filter(([key]) => key !== "PASSABLE")
                .map(([key, item]) => (
                  <View key={item.label} style={styles.legendRow}>
                    <View style={[styles.swatch, { backgroundColor: statusColor[key as StatusKey] }]} />
                    <Text style={styles.legendText}>{item.label}</Text>
                  </View>
                ))
            : null}
          {viewMode !== "passability"
            ? Object.entries(TRAFFIC_STYLE)
                .filter(([key]) => key !== "success")
                .map(([key, item]) => (
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
    meHalo: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(37,99,235,0.22)",
      alignItems: "center",
      justifyContent: "center",
    },
    meDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#ffffff" },
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
  });
}
