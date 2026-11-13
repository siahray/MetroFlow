import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polygon, Polyline, type Region } from "react-native-maps";
import { Navigation2 } from "lucide-react-native";

import type { EdgeFeature, HazardInfo, RoutePlan } from "../api";
import { polygonRing, routeCoordinates, type LatLng, type NavCamera } from "./geo";

import { fontSize, space, useTheme, type ThemeColors } from "../theme";

/** Close-up driving camera while a route is active, matching a turn-by-turn app. */
const NAV_CAMERA: NavCamera = { zoom: 17.5, altitude: 400 };
const NAV_PITCH = 55;

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

/** Flood passability only, the platform's own live traffic, or flood status
 * layered over live traffic (flood safety is the more critical signal, so a
 * flooded segment is always painted; a clear one is left to the native
 * traffic colouring underneath). ``traffic`` is the normal-map view: the
 * platform's real-time traffic, no flood overlay at all. */
export type MapViewMode = "passability" | "traffic" | "both";

type MapHazard = Pick<HazardInfo, "hazard_id" | "name" | "obstruction_level" | "geometry">;

type Props = {
  route: RoutePlan | null;
  /** True once the driver has tapped Start; false during the route preview
   * (route drawn, but no follow camera and no close-up zoom yet). */
  active?: boolean;
  position: LatLng | null;
  /** Device compass heading in degrees, for the driving-camera bearing. */
  heading?: number | null;
  /** Speed/turn-aware camera distance (navigation/geo.ts navZoomFor); falls
   * back to the fixed NAV_CAMERA when not supplied. */
  navZoom?: NavCamera | null;
  destination: LatLng | null;
  destinationName: string | null;
  hazards: MapHazard[];
  edges?: EdgeFeature[];
  viewMode?: MapViewMode;
};

function blocking(level: string) {
  return ["LEVEL_2", "LEVEL_3", "IMPASSABLE"].includes(level.toUpperCase());
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
  active = false,
  position,
  heading = null,
  navZoom = null,
  destination,
  destinationName,
  hazards,
  edges = [],
  viewMode = "passability",
}, ref) {
  const { c, mode } = useTheme();
  const styles = useMemo(() => makeStyles(c, mode), [c, mode]);
  const statusColor = useMemo(() => STATUS_COLOR(c), [c]);
  const mapRef = useRef<MapView>(null);
  // Flatten the tilt a little once zoomed out for speed, matching the wider,
  // flatter view Google Maps shows at highway zoom levels.
  const effectiveCamera = navZoom ?? NAV_CAMERA;
  const effectivePitch = effectiveCamera.zoom >= 17 ? NAV_PITCH : 40;

  // Google-Maps-style driving mode: once navigation is active (not just a
  // route preview), the camera follows the driver, close and heading-up,
  // until a manual pan releases it (onPanDrag below) -- then a "Recenter"
  // chip brings it back. Re-engaging follow when `active` turns on is
  // React's "adjust state during render" pattern (comparing against the
  // previous render's own state, not a ref), so it does not cascade an
  // extra render.
  const [following, setFollowing] = useState(true);
  const [prevActiveForFollow, setPrevActiveForFollow] = useState(active);
  if (active !== prevActiveForFollow) {
    setPrevActiveForFollow(active);
    if (active && !following) setFollowing(true);
  }

  const recenter = useCallback(() => {
    setFollowing(true);
    if (!position) return;
    if (active) {
      mapRef.current?.animateCamera(
        {
          center: position,
          heading: heading ?? 0,
          pitch: effectivePitch,
          zoom: effectiveCamera.zoom,
          altitude: effectiveCamera.altitude,
        },
        { duration: 350 },
      );
    } else {
      mapRef.current?.animateCamera({ center: position }, { duration: 300 });
    }
  }, [position, active, heading, effectivePitch, effectiveCamera]);

  useImperativeHandle(ref, () => ({
    recenter,
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
  }), [recenter]);

  // The driving camera: re-centres on every position/heading tick while
  // following is engaged and navigation is active. A manual pan (onPanDrag)
  // disengages it so the driver can look around without fighting the camera.
  useEffect(() => {
    if (!following || !active || !position) return;
    mapRef.current?.animateCamera(
      {
        center: position,
        heading: heading ?? 0,
        pitch: effectivePitch,
        zoom: effectiveCamera.zoom,
        altitude: effectiveCamera.altitude,
      },
      { duration: 450 },
    );
  }, [following, active, position, heading, effectivePitch, effectiveCamera]);

  // The route bounds frame the map when a plan exists.
  const routeRegion = useMemo(
    () => (route ? regionFor(routeCoordinates(route), null) : null),
    [route],
  );
  const roads = useMemo(() => {
    // Traffic is the platform's own real-time layer now (showsTraffic below),
    // not something we draw: nothing of ours to paint in that mode.
    if (viewMode === "traffic") return [];
    // Only a flagged edge is painted, in both "passability" and "both": at
    // the real OSM network's scale (~10,876 edges) painting every passable
    // road green turned the whole map into a solid green mass. A clear road
    // is left to the plain basemap (and, in "both", the native traffic
    // layer) -- flood status is what must stand out, not the absence of it.
    const edgesToPaint = edges.filter((edge) => edge.properties.status !== "PASSABLE");
    return edgesToPaint.map((edge) => ({
      id: edge.properties.edge_id,
      color: statusColor[edge.properties.status as StatusKey] ?? c.slate600,
      points: edge.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
    }));
  }, [edges, viewMode, statusColor, c.slate600]);
  // With no fix and no route, frame the whole road network instead of leaving the map blank.
  const networkRegion = useMemo(() => regionFor(roads.flatMap((r) => r.points), null), [roads]);
  // The camera is framed once, then left alone. A controlled `region` prop would
  // re-apply on every GPS tick and yank the map back, fighting the driver's panning.
  const [initialRegion] = useState<Region | undefined>(
    () => routeRegion ?? (position ? regionFor([], position) : undefined) ?? undefined,
  );
  const framed = useRef(initialRegion !== undefined);
  const framedOnFix = useRef(false);
  // Only a genuinely new route re-frames the map; without this, `position`
  // in the deps below would re-run the whole-route framing on every GPS tick
  // and fight the driving camera above for control of the map.
  const lastFramedRoute = useRef<RoutePlan | null>(null);
  useEffect(() => {
    if (!route) lastFramedRoute.current = null;

    // A newly planned route is the one thing that always re-frames the map.
    if (routeRegion && route !== lastFramedRoute.current) {
      lastFramedRoute.current = route;
      framed.current = true;
      framedOnFix.current = true;
      mapRef.current?.animateToRegion(routeRegion, 500);
      return;
    }
    // The first fix wins over the whole-network overview: at that zoom the road
    // colours are a hairball, which looks like the flood layer is missing.
    if (position && !framedOnFix.current) {
      const fix = regionFor([], position);
      if (fix) {
        framedOnFix.current = true;
        mapRef.current?.animateToRegion(fix, 300);
        return;
      }
    }
    if (framed.current) return;
    if (!networkRegion) return;
    framed.current = true;
    mapRef.current?.animateToRegion(networkRegion, 0);
  }, [route, routeRegion, networkRegion, position]);

  // Rebuilt only when the plan changes: the route line is the most visible thing
  // on screen, so it must not be re-derived on every GPS tick.
  const routeLine = useMemo(() => (route ? routeCoordinates(route) : []), [route]);

  // Built once per road set and then left mounted: tearing overlays down on each
  // pan end costs more than leaving them in the native overlay layer.
  const roadLines = useMemo(
    () =>
      roads.map((road) => (
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

  // The normal-map view is live traffic only: no flood polygons.
  const floodOverlay = viewMode !== "traffic";

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        toolbarEnabled={false}
        // The platform's own real-time traffic layer powers "Normal map" and
        // "Flood + traffic" instead of a colouring we compute ourselves.
        showsTraffic={viewMode !== "passability"}
        // A direct user drag (not our own animateCamera calls) releases the
        // driving camera, same as Google Maps; the chip below brings it back.
        onPanDrag={() => setFollowing(false)}
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

        {position ? (
          <Marker
            key={active ? "nav-arrow" : "me-dot"}
            coordinate={position}
            title="Your location"
            anchor={{ x: 0.5, y: 0.5 }}
            // `flat` keeps the rotation tied to true compass heading on the
            // map itself (not the screen), so the arrow still points the
            // right way even if the driving camera's own rotation lags or
            // the driver has panned away from follow.
            flat={active}
            rotation={active ? heading ?? 0 : 0}
            tracksViewChanges={false}
          >
            {active ? (
              // The Google-Maps-style navigation puck: a white-ringed blue
              // disc with a white chevron pointing "up" (true north before
              // rotation), replacing the plain dot once the driver taps
              // Start. The ring reads clearly over any road colour or
              // basemap tile, unlike a bare triangle.
              <View style={styles.navPuckWrap}>
                <View style={[styles.navPuckDisc, { backgroundColor: c.blue600 }]}>
                  <View style={styles.navPuckArrow} />
                </View>
              </View>
            ) : (
              <View style={styles.meHalo}>
                <View style={[styles.meDot, { backgroundColor: c.blue600 }]} />
              </View>
            )}
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
      {/* Traffic is the platform's own layer now, with its own legend built
          in; this one is only ever flood status, and only when something is
          actually painted (empty in "traffic" mode, where roads is always [],
          and PASSABLE is left out -- it's never drawn, see `roads` above). */}
      {roads.length > 0 ? (
        <View style={styles.legend}>
          {Object.entries(STATUS_STYLE)
            .filter(([key]) => key !== "PASSABLE")
            .map(([key, item]) => (
              <View key={item.label} style={styles.legendRow}>
                <View style={[styles.swatch, { backgroundColor: statusColor[key as StatusKey] }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
        </View>
      ) : null}

      {active && !following ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Resume following my location"
          onPress={recenter}
          style={styles.recenterChip}
        >
          <Navigation2 size={14} color={c.white} />
          <Text style={styles.recenterChipText}>Recenter</Text>
        </TouchableOpacity>
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
    // The navigation puck: a soft outer glow, a white ring, a blue disc, and
    // a small white chevron (a classic zero-size-View CSS triangle) pointing
    // "up" before the Marker's own `rotation` turns it to true heading.
    navPuckWrap: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(37,99,235,0.18)",
      borderRadius: 20,
    },
    navPuckDisc: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 3,
      borderColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#0f172a",
      shadowOpacity: 0.35,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    navPuckArrow: {
      width: 0,
      height: 0,
      marginTop: -2,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderBottomWidth: 8,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderBottomColor: "#ffffff",
    },
    swatch: { width: 14, height: 4, borderRadius: 2 },
    legendText: { fontSize: fontSize.micro, color: c.slate600 },
    recenterChip: {
      // Bottom, not top: the top is the instruction card's territory (its
      // height varies with the instruction text), and the bottom sheet sits
      // outside this container entirely, so this clears both without
      // needing to know either one's exact size.
      position: "absolute",
      bottom: 16,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: space[6],
      backgroundColor: "rgba(15,23,42,0.92)",
      borderRadius: 999,
      paddingHorizontal: space[14],
      paddingVertical: space[8],
    },
    recenterChipText: { fontSize: fontSize.caption, fontWeight: "700", color: "#ffffff" },
  });
}
