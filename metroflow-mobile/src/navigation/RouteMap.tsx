import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  Camera,
  CameraGestureObserver,
  FillLayer,
  LineLayer,
  MapView,
  MarkerView,
  ShapeSource,
} from "@rnmapbox/maps";
import { Navigation2 } from "lucide-react-native";

import type { EdgeFeature, HazardInfo, RoutePlan } from "../api";
import {
  distanceMeters,
  polygonRing,
  routeBearing,
  routeCoordinates,
  snapToRoute,
  toLatLng,
  type LatLng,
  type NavCamera,
} from "./geo";
import { MAPBOX_STYLE_DAY, MAPBOX_STYLE_NIGHT, mapboxReady } from "./mapbox";

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
 * flooded segment is always painted; a clear one is left to the plain basemap
 * underneath). ``traffic`` is the normal-map view: no flood overlay at all. */
export type MapViewMode = "passability" | "traffic" | "both";

type MapHazard = Pick<HazardInfo, "hazard_id" | "name" | "obstruction_level" | "geometry">;

type Props = {
  route: RoutePlan | null;
  /** True once the driver has tapped Start; false during the route preview
   * (route drawn, but no follow camera and no close-up zoom yet). */
  active?: boolean;
  position: LatLng | null;
  /** GPS course in degrees, last-resort driving-camera bearing. */
  heading?: number | null;
  /** Device compass heading in degrees (where the phone points) — primary
   * bearing while navigating, falling back to the road's own direction. */
  compassHeading?: number | null;
  /** Speed/turn-aware camera distance (navigation/geo.ts navZoomFor); falls
   * back to the fixed NAV_CAMERA when not supplied. */
  navZoom?: NavCamera | null;
  destination: LatLng | null;
  destinationName: string | null;
  hazards: MapHazard[];
  edges?: EdgeFeature[];
  viewMode?: MapViewMode;
  /** A long-press on the basemap, for "drop a pin" destination picking.
   * Omit to disable the gesture (e.g. during active navigation). */
  onLongPressMap?: (point: LatLng) => void;
};

function blocking(level: string) {
  return ["LEVEL_2", "LEVEL_3", "IMPASSABLE"].includes(level.toUpperCase());
}

type Bounds = { ne: [number, number]; sw: [number, number] };

/** Mapbox wants [longitude, latitude] corners; a single point has no box. */
function boundsFor(coordinates: LatLng[]): Bounds | null {
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
  if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
  if (minLat === maxLat && minLon === maxLon) return null;
  return { ne: [maxLon, maxLat], sw: [minLon, minLat] };
}

const emptyLines: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
  type: "FeatureCollection",
  features: [],
};

export const RouteMap = forwardRef<RouteMapHandle, Props>(function RouteMap({
  route,
  active = false,
  position,
  heading = null,
  compassHeading = null,
  navZoom = null,
  destination,
  hazards,
  edges = [],
  viewMode = "passability",
  onLongPressMap,
}, ref) {
  // Do not mount <MapView> until the native SDK actually has the token --
  // see `mapboxReady` in mapbox.ts for why.
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void mapboxReady.then(() => {
      if (!cancelled) setMapReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { c, mode } = useTheme();
  const styles = useMemo(() => makeStyles(c, mode), [c, mode]);
  const statusColor = useMemo(() => STATUS_COLOR(c), [c]);
  const cameraRef = useRef<ComponentRef<typeof Camera>>(null);
  // Flatten the tilt a little once zoomed out for speed, matching the wider,
  // flatter view a turn-by-turn app shows at highway zoom levels.
  const effectiveCamera = navZoom ?? NAV_CAMERA;
  const effectivePitch = effectiveCamera.zoom >= 17 ? NAV_PITCH : 40;

  // Driving mode: once navigation is active (not just a route preview), the
  // camera follows the driver, close and heading-up, until a manual pan
  // releases it (the gesture observer below) -- then a "Recenter" chip brings
  // it back. Re-engaging follow when `active` turns on is React's "adjust
  // state during render" pattern (comparing against the previous render's own
  // state, not a ref), so it does not cascade an extra render.
  const [following, setFollowing] = useState(true);
  const [prevActiveForFollow, setPrevActiveForFollow] = useState(active);
  if (active !== prevActiveForFollow) {
    setPrevActiveForFollow(active);
    if (active && !following) setFollowing(true);
  }

  const [zoomLevel, setZoomLevel] = useState(effectiveCamera.zoom);

  // Map-matched position while actively navigating: the raw GPS fix is shown
  // during route preview (so the connector below makes sense), but once
  // driving, the puck follows the route line itself, same as any turn-by-turn
  // app -- a few metres of GPS jitter should never show the arrow drifting
  // off the road it's actually following.
  const displayPosition = useMemo(() => {
    if (!active || !route || !position) return position;
    return snapToRoute(routeCoordinates(route), position) ?? position;
  }, [active, route, position]);

  // Heading-up bearing: the compass points where the phone is aimed; when it
  // has no usable reading (stationary, uncalibrated, simulator), the road ahead
  // keeps the map aligned, and GPS course is the final fallback.
  const routeHeading = useMemo(
    () =>
      active && route && displayPosition
        ? routeBearing(routeCoordinates(route), displayPosition)
        : null,
    [active, route, displayPosition],
  );
  const cameraHeading = compassHeading ?? routeHeading ?? heading ?? 0;

  const recenter = useCallback(() => {
    setFollowing(true);
    // The effect below only re-centres continuously while `active` (actual
    // turn-by-turn), so a "locate me" tap before Start -- or at any point
    // during preview -- did nothing at all. A one-shot camera move here
    // covers that case without turning this into a continuous follow.
    if (!active && displayPosition) {
      cameraRef.current?.setCamera({
        centerCoordinate: [displayPosition.longitude, displayPosition.latitude],
        zoomLevel: 14,
        animationDuration: 300,
      });
    }
  }, [active, displayPosition]);

  useImperativeHandle(
    ref,
    () => ({
      recenter,
      zoomIn: () => setZoomLevel((z) => z + 1),
      zoomOut: () => setZoomLevel((z) => Math.max(z - 1, 1)),
    }),
    [recenter],
  );

  // Position/destination at the moment `route` itself changes, captured via
  // React's "adjust state during render" pattern (see `prevActiveForFollow`
  // above) rather than a ref: a GPS tick must not produce a new bounds
  // object on every render, or it re-triggers `fitBounds` every few seconds
  // and fights the driving camera (same reason `lastFramedRoute` exists
  // further down), but reading a ref during render is also disallowed
  // (`react-hooks/refs`).
  const [prevRouteForBounds, setPrevRouteForBounds] = useState(route);
  const [boundsExtra, setBoundsExtra] = useState({ position, destination });
  if (route !== prevRouteForBounds) {
    setPrevRouteForBounds(route);
    setBoundsExtra({ position, destination });
  }

  // The route bounds frame the map when a plan exists (and no driver follow).
  // Includes position/destination so a connector segment (above) never gets
  // cropped out of frame when the graph's start/end node sits off the route
  // bounds themselves.
  const routeBounds = useMemo(
    () =>
      route
        ? boundsFor([
            ...routeCoordinates(route),
            ...(boundsExtra.position ? [boundsExtra.position] : []),
            ...(boundsExtra.destination ? [boundsExtra.destination] : []),
          ])
        : null,
    [route, boundsExtra],
  );

  // Imperative camera: declarative props would re-apply a follow centre on
  // every render, including while the driver is panning the map.
  const fittedBounds = useRef<Bounds | null>(null);
  const appliedZoom = useRef(zoomLevel);
  const centredOnce = useRef(false);

  // Switching storm/day re-keys <MapView> below (so its style reload doesn't
  // race the hazard/flood layers -- see the key comment there), which mounts
  // a brand-new native Camera with no notion of where the map was framed.
  // Clearing these lets the effect below re-apply the current camera state
  // to it immediately, instead of leaving it on the SDK's default view until
  // the next GPS tick happens to change a dependency.
  useEffect(() => {
    fittedBounds.current = null;
    centredOnce.current = false;
  }, [mode]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    if (following && active && displayPosition) {
      camera.setCamera({
        centerCoordinate: [displayPosition.longitude, displayPosition.latitude],
        zoomLevel,
        heading: cameraHeading,
        pitch: effectivePitch,
        animationDuration: 450,
        animationMode: "easeTo",
      });
      return;
    }

    if (routeBounds && fittedBounds.current !== routeBounds) {
      fittedBounds.current = routeBounds;
      // Top padding clears the instruction card, bottom the preview sheet.
      camera.fitBounds(routeBounds.ne, routeBounds.sw, [120, 40, 260, 40], 700);
      return;
    }

    if (appliedZoom.current !== zoomLevel) {
      appliedZoom.current = zoomLevel;
      camera.zoomTo(zoomLevel, 200);
      return;
    }

    // Before any plan exists, centre on the driver once so the map is not
    // sitting on the SDK's default ocean view.
    if (!routeBounds && !centredOnce.current && position) {
      centredOnce.current = true;
      camera.setCamera({
        centerCoordinate: [position.longitude, position.latitude],
        zoomLevel: 14,
        animationDuration: 0,
      });
    }
  }, [following, active, displayPosition, position, cameraHeading, zoomLevel, effectivePitch, routeBounds, mode]);

  const routeShape = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (!route) return null;
    const coordinates = route.geometry.coordinates;
    if (coordinates.length < 2) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    };
  }, [route]);

  // The flood-safe engine can only start/end a route at a road-graph node,
  // which can sit a real distance from the driver's actual GPS fix or the
  // searched place (e.g. across a park, with no node inside it) -- a dry
  // Mapbox route already starts/ends at the true coordinates (CR-008-era
  // door-to-door fix) and never needs this. These are display-only dashed
  // "connector" segments so the route doesn't look disconnected from the
  // driver/destination pins; they never feed progress, ETA or instructions,
  // which stay keyed to `route.geometry.coordinates` exactly as returned.
  const CONNECTOR_MIN_M = 25;
  const connectors = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(() => {
    const coordinates = route?.geometry.coordinates;
    if (!coordinates || coordinates.length < 2) {
      return { type: "FeatureCollection", features: [] };
    }
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    const first = toLatLng(coordinates[0] as [number, number]);
    const last = toLatLng(coordinates[coordinates.length - 1] as [number, number]);
    // Once actively navigating, the puck is snapped onto the route itself
    // (`displayPosition` above) -- a dashed line back to the raw GPS fix
    // would just contradict what the puck is showing. Preview-only.
    if (!active && position && distanceMeters(position, first) > CONNECTOR_MIN_M) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [[position.longitude, position.latitude], coordinates[0]],
        },
      });
    }
    if (destination && distanceMeters(destination, last) > CONNECTOR_MIN_M) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [coordinates[coordinates.length - 1], [destination.longitude, destination.latitude]],
        },
      });
    }
    return { type: "FeatureCollection", features };
  }, [route, position, destination, active]);

  // Flagged edges only, grouped by status so each layer has one constant
  // colour (theme-driven) instead of a style expression. At the real OSM
  // network's scale (~10,876 edges) painting every passable road turned the
  // map into a solid mass: flood status must stand out, not the absence of it.
  const flagged = useMemo<Record<"LIGHT_FLOOD" | "SUBMERGED", GeoJSON.FeatureCollection<GeoJSON.LineString>>>(
    () => {
      if (viewMode === "traffic") {
        return { LIGHT_FLOOD: emptyLines, SUBMERGED: emptyLines };
      }
      const groups = {
        LIGHT_FLOOD: [] as GeoJSON.Feature<GeoJSON.LineString>[],
        SUBMERGED: [] as GeoJSON.Feature<GeoJSON.LineString>[],
      };
      for (const edge of edges) {
        const status = edge.properties.status;
        if (status !== "LIGHT_FLOOD" && status !== "SUBMERGED") continue;
        groups[status].push({
          type: "Feature",
          properties: {},
          geometry: edge.geometry,
        });
      }
      return {
        LIGHT_FLOOD: { type: "FeatureCollection", features: groups.LIGHT_FLOOD },
        SUBMERGED: { type: "FeatureCollection", features: groups.SUBMERGED },
      };
    },
    [edges, viewMode],
  );

  // Hazard outlines, rebuilt only when the hazard set changes.
  const hazardShapes = useMemo(() => {
    const closed: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
    const open: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
    for (const hazard of hazards) {
      const ring = polygonRing(hazard.geometry);
      if (ring.length < 3) continue;
      const feature: GeoJSON.Feature<GeoJSON.Polygon> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [ring.map((point) => [point.longitude, point.latitude])],
        },
      };
      (blocking(hazard.obstruction_level) ? closed : open).push(feature);
    }
    return {
      closed: { type: "FeatureCollection", features: closed } as GeoJSON.FeatureCollection<GeoJSON.Polygon>,
      open: { type: "FeatureCollection", features: open } as GeoJSON.FeatureCollection<GeoJSON.Polygon>,
    };
  }, [hazards]);

  // The normal-map view is live traffic only: no flood polygons.
  const floodOverlay = viewMode !== "traffic";
  const paintedEdges = flagged.LIGHT_FLOOD.features.length + flagged.SUBMERGED.features.length;

  if (!mapReady) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <MapView
        // Keyed on the style itself: switching styleURL makes the native SDK
        // reload the whole style, which drops every source/layer. React still
        // sees the same ShapeSource/FillLayer elements and just pushes a prop
        // update to them, which lands after the reload has already dropped
        // them -- the native side rejects it ("Layer 'X' is not in style").
        // The key forces a full unmount/remount of this subtree instead, so
        // the layers are freshly (re)created against the style that's
        // actually loaded. The effect above restores the camera position
        // immediately after, since a fresh native Camera has no memory of it.
        key={mode}
        style={StyleSheet.absoluteFill}
        styleURL={mode === "storm" ? MAPBOX_STYLE_NIGHT : MAPBOX_STYLE_DAY}
        scaleBarEnabled={false}
        onLongPress={(feature) => {
          if (!onLongPressMap) return;
          const [longitude, latitude] = feature.geometry.coordinates;
          onLongPressMap({ latitude, longitude });
        }}
      >
        <Camera ref={cameraRef} defaultSettings={{ zoomLevel: 12 }} />
        <CameraGestureObserver
          onCameraChanged={(event) => {
            // A gesture releases the follow camera; our own setCamera calls
            // are programmatic and report isUserInteraction false.
            if (event.nativeEvent.properties.isUserInteraction) setFollowing(false);
          }}
        />

        {floodOverlay ? (
          <>
            <ShapeSource id="flagged-light" shape={flagged.LIGHT_FLOOD}>
              <LineLayer
                id="flagged-light-line"
                style={{ lineColor: statusColor.LIGHT_FLOOD, lineWidth: 4, lineCap: "round" }}
              />
            </ShapeSource>
            <ShapeSource id="flagged-submerged" shape={flagged.SUBMERGED}>
              <LineLayer
                id="flagged-submerged-line"
                style={{ lineColor: statusColor.SUBMERGED, lineWidth: 4, lineCap: "round" }}
              />
            </ShapeSource>
          </>
        ) : null}

        {routeShape ? (
          <>
            {/* White casing under the blue line: the familiar route look. */}
            <ShapeSource id="route" shape={routeShape}>
              <LineLayer
                id="route-casing"
                style={{ lineColor: "#ffffff", lineWidth: 9, lineCap: "round", lineJoin: "round" }}
              />
              <LineLayer
                id="route-line"
                style={{ lineColor: c.blue600, lineWidth: 5, lineCap: "round", lineJoin: "round" }}
              />
            </ShapeSource>
            {connectors.features.length > 0 ? (
              <ShapeSource id="route-connectors" shape={connectors}>
                <LineLayer
                  id="route-connectors-line"
                  style={{
                    lineColor: c.blue600,
                    lineWidth: 3,
                    lineCap: "round",
                    lineDasharray: [2, 2],
                    lineOpacity: 0.6,
                  }}
                />
              </ShapeSource>
            ) : null}
          </>
        ) : null}

        {floodOverlay && hazardShapes.open.features.length > 0 ? (
          <ShapeSource id="hazard-open" shape={hazardShapes.open}>
            <FillLayer
              id="hazard-open-fill"
              style={{
                fillColor: c.amber500,
                fillOpacity: 0.22,
                fillOutlineColor: c.amber500,
              }}
            />
          </ShapeSource>
        ) : null}

        {floodOverlay && hazardShapes.closed.features.length > 0 ? (
          <ShapeSource id="hazard-closed" shape={hazardShapes.closed}>
            <FillLayer
              id="hazard-closed-fill"
              style={{
                fillColor: c.red600,
                fillOpacity: 0.25,
                fillOutlineColor: c.red600,
              }}
            />
          </ShapeSource>
        ) : null}

        {displayPosition ? (
          <MarkerView
            coordinate={[displayPosition.longitude, displayPosition.latitude]}
            key={active ? "nav-arrow" : "me-dot"}
          >
            {active ? (
              // The navigation puck: a white-ringed blue disc with a white
              // chevron pointing "up", which is screen-up under the
              // heading-up driving camera. The ring reads clearly over any
              // road colour or basemap tile, unlike a bare triangle.
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
          </MarkerView>
        ) : null}

        {destination ? (
          <MarkerView coordinate={[destination.longitude, destination.latitude]}>
            <View style={[styles.destinationMarker, { backgroundColor: c.red600 }]} />
          </MarkerView>
        ) : null}
      </MapView>

      {/* Flood status only, and only when something is actually painted
          (empty in "traffic" mode, and PASSABLE is never drawn). */}
      {paintedEdges > 0 ? (
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
      borderRadius: 10,
      paddingHorizontal: space[10],
      paddingVertical: space[8],
      gap: space[5],
    },
    legendRow: { flexDirection: "row", alignItems: "center", gap: space[8] },
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
    // a small white chevron (a classic zero-size-View CSS triangle).
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
    swatch: { width: 9, height: 9, borderRadius: 5 },
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
    destinationMarker: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 3,
      borderColor: "#ffffff",
    },
  });
}
