import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Droplet,
  Flag,
  Sun,
  Gauge,
  Layers,
  LocateFixed,
  MapPin,
  Moon,
  Navigation,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Waves,
  Wifi,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react-native";

import {
  ApiError,
  getNetworkState,
  getRoute,
  type EdgeFeature,
  type HazardInfo,
  type NetworkState,
  type NodeFeature,
  type RouteHazard,
  type RoutePlan,
  postTelemetry,
} from "../api";
import { useAuth } from "../auth";
import { Avatar } from "../components/Avatar";
import { BackButton } from "../components/BackButton";
import { useDialog } from "../components/Dialog";
import { RouteMap, type RouteMapHandle } from "../navigation/RouteMap";
import { subscribeToHazards } from "../navigation/hazard-stream";
import { planRouteOffline } from "../navigation/offline-route";
import { loadCache, saveCache, useOnline } from "../offline";
import { loadMyVehicle } from "../myVehicle";
import { usePrefs, savePrefs } from "../prefs";
import {
  distanceToPolygonMeters,
  formatDistance,
  formatDuration,
  instructionIndexForProgress,
  nearestNode,
  polygonRing,
  progressAlongRoute,
  remainingOnStep,
  routeCoordinates,
  toLatLng,
  type LatLng,
} from "../navigation/geo";

import { fontSize, space, useTheme, type ThemeColors, type ThemeMode } from '../theme';

type Banner = {
  title: string;
  body: string;
  tone: "warning" | "danger" | "success";
} | null;

function bannerColors(c: ThemeColors) {
  return {
    warning: { background: c.amberSurface, border: c.amber500, text: c.amber800 },
    danger: { background: c.red50, border: c.red600, text: c.red800 },
    success: {
      background: c.green50,
      border: c.green600,
      text: c.green700,
    },
  } as const;
}

function hazardAdvice(level: string): { label: string; action: string } {
  switch (level.toUpperCase()) {
    case "IMPASSABLE":
      return { label: "Road impassable", action: "Do not enter. Use another route." };
    case "LEVEL_3":
      return { label: "Waist-deep flooding", action: "Turn around and reroute." };
    case "LEVEL_2":
      return { label: "Knee-deep flooding", action: "Find another route." };
    default:
      return { label: "Ankle-deep flooding", action: "Proceed slowly with caution." };
  }
}

/** Direction icon per manoeuvre (P2-6): the turn-by-turn card shows a shape, not just text. */
const MANOEUVRE_ICON: Record<string, typeof ArrowUp> = {
  DEPART: ArrowUp,
  STRAIGHT: ArrowUp,
  TURN_LEFT: ArrowLeft,
  TURN_RIGHT: ArrowRight,
  SLIGHT_LEFT: CornerUpLeft,
  SLIGHT_RIGHT: CornerUpRight,
  U_TURN: RotateCcw,
  ARRIVE: Flag,
};

/** Wall-clock arrival estimate from now plus the remaining travel time. */
function formatEta(remainingMinutes: number): string {
  const eta = new Date(Date.now() + remainingMinutes * 60_000);
  return eta.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function samePath(a: RoutePlan, b: RoutePlan) {
  return a.optimal_path_nodes.join(",") === b.optimal_path_nodes.join(",");
}

// shortcut: snap-on-release sheet drag (plain RN LayoutAnimation + PanResponder), not a
// 1:1 finger-follow — upgrade with react-native-reanimated if fluid tracking is wanted.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SEGMENT_STATUS_LABEL: Record<string, string> = {
  PASSABLE: "Paved",
  LIGHT_FLOOD: "Light flood",
  SUBMERGED: "Submerged",
};

/** Flow label from real recorded speed vs. the road's posted limit — never a fabricated traffic feed. */
function congestionFromSpeeds(avgKmh: number, maxKmh: number): { label: string; tone: "success" | "warning" | "danger" } {
  const ratio = maxKmh > 0 ? avgKmh / maxKmh : 1;
  if (ratio >= 0.8) return { label: "Flowing", tone: "success" };
  if (ratio >= 0.5) return { label: "Moderate", tone: "warning" };
  return { label: "Congested", tone: "danger" };
}

export default function RouteScreen({ edges }: { edges?: Edge[] } = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const { confirm } = useDialog();
  const { c, mode, toggle: toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(c, mode), [c, mode]);
  const BANNER_COLORS = useMemo(() => bannerColors(c), [c]);
  const { destination: destinationParam } = useLocalSearchParams<{ destination?: string }>();

  const [network, setNetwork] = useState<NetworkState | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  // The driver's own vehicle, configured in Profile — reload on each visit.
  const [clearanceCm, setClearanceCm] = useState(28);
  useFocusEffect(
    useCallback(() => {
      void loadMyVehicle().then((v) => setClearanceCm(v.clearanceCm));
    }, []),
  );
  // Telemetry display (P3-4): the driver's own read of what is being sent.
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const online = useOnline();
  const prefs = usePrefs();
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  // Bumped by the Retry action so the one-shot location effect runs again.
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [selected, setSelected] = useState<NodeFeature | null>(null);
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [hazards, setHazards] = useState<HazardInfo[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [planning, setPlanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState(false);
  const [unsafeRoute, setUnsafeRoute] = useState(false);
  const [arrived, setArrived] = useState(false);
  // Bottom-sheet presentation (Google-Maps-style): expanded shows the full route
  // preview, compact shows only the floating turn card and a slim summary.
  const [expanded, setExpanded] = useState(true);

  const mapRef = useRef<RouteMapHandle>(null);
  const routeRef = useRef<RoutePlan | null>(null);
  const positionRef = useRef<LatLng | null>(null);
  const networkRef = useRef<NetworkState | null>(null);
  const hazardsRef = useRef<HazardInfo[]>([]);
  const unsafeRef = useRef(false);
  const prefsRef = useRef(prefs);
  const plannedFor = useRef<number | null>(null);
  const initialDestinationHandled = useRef(false);
  const hazardsInitialised = useRef(false);
  const arrivedRef = useRef(false);
  const alertedHazards = useRef<Set<number>>(new Set());
  // Telemetry: track the wall-clock time of the last successful ping so we
  // respect the server-side 5-second throttle without duplicating its logic
  // (FSD-FR-072, VAL-020). The unit comes from the signed-in driver's account.
  const lastTelemetrySentMs = useRef<number>(0);
  const telemetryVehicleId = user?.vehicle_id ?? null;

  useEffect(() => {
    routeRef.current = route;
  }, [route]);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    networkRef.current = network;
  }, [network]);
  useEffect(() => {
    hazardsRef.current = hazards;
  }, [hazards]);
  useEffect(() => {
    unsafeRef.current = unsafeRoute;
  }, [unsafeRoute]);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // --- Offline fallback (FSD-FR-071) ---------------------------------------
  // The API call fails outright with no connection; a real routing refusal
  // (404) must still surface as "no safe route" rather than retry locally.
  const requestRoute = useCallback(
    (params: { start_node: number; target_node: number; clearance_cm: number; ignore_hazards?: boolean }) =>
      getRoute(params).catch((cause: unknown) => {
        if (cause instanceof ApiError) throw cause;
        const net = networkRef.current;
        const plan = net
          ? planRouteOffline(
              net,
              hazardsRef.current,
              params.start_node,
              params.target_node,
              params.clearance_cm,
              params.ignore_hazards ?? false,
            )
          : null;
        if (!plan) {
          throw new ApiError(404, "No safe route available under current flood conditions.");
        }
        return plan;
      }),
    [],
  );

  // --- Location ------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          if (!cancelled) {
            setLocationPermissionDenied(true);
            setLocationError(
              "MetroFlow needs your location to plan a flood-safe route and warn you about nearby hazards.",
            );
          }
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        setLocationPermissionDenied(false);
        setLocationError(null);

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 10,
          },
          (update) => {
            if (cancelled) return;
            setPosition({
              latitude: update.coords.latitude,
              longitude: update.coords.longitude,
            });
            setSpeedKmh(update.coords.speed != null ? Math.max(update.coords.speed * 3.6, 0) : null);
            setGpsAccuracyM(update.coords.accuracy ?? null);
            setHeadingDeg(update.coords.heading ?? null);

            // --- Telemetry sender (FSD-FR-072) --------------------------------
            // Fire-and-forget: only while actively navigating as a linked unit.
            if (
              prefsRef.current.telemetry &&
              telemetryVehicleId !== null &&
              routeRef.current !== null
            ) {
              const nowMs = Date.now();
              if (nowMs - lastTelemetrySentMs.current >= 5000) {
                lastTelemetrySentMs.current = nowMs;
                postTelemetry(telemetryVehicleId, {
                  latitude: update.coords.latitude,
                  longitude: update.coords.longitude,
                  speed_kmh:
                    update.coords.speed != null
                      ? update.coords.speed * 3.6
                      : null,
                  heading: update.coords.heading ?? null,
                  recorded_at: new Date(update.timestamp).toISOString(),
                })
                  .then(() => setLastSyncAt(new Date()))
                  .catch(() => {
                    // Silent failure: telemetry is best-effort; navigation
                    // continues unaffected even if the ping is throttled or lost.
                  });
              }
            }
          },
        );
      } catch {
        if (!cancelled) setLocationError("Could not read your location. Check GPS and retry.");
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [user, telemetryVehicleId, locationAttempt]);

  // --- Road network --------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getNetworkState(clearanceCm)
      .then((state) => {
        void saveCache("network", state);
        if (!cancelled) setNetwork(state);
      })
      .catch(async (cause: unknown) => {
        // Offline: fall back to the last graph and route (FSD-FR-070, 071).
        const cached = await loadCache<NetworkState>("network");
        if (cancelled) return;
        if (cached) {
          setNetwork(cached);
          setHazards((await loadCache<HazardInfo[]>("hazards")) ?? []);
          const lastRoute = await loadCache<RoutePlan>("route");
          if (lastRoute) setRoute(lastRoute);
          setError("Offline: showing the last saved map and route.");
        } else {
          setError(cause instanceof Error ? cause.message : "Could not load the road network.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, clearanceCm]);

  // --- Live verified hazards (FSD-FR-059) ---------------------------------
  useEffect(() => {
    if (!user) return;
    return subscribeToHazards({
      onSnapshot: (snapshot) => {
        void saveCache("hazards", snapshot);
        setHazards(snapshot);
        setStreamError(null);
      },
      onHazard: (event, hazard) => {
        setHazards((previous) => {
          if (event === "hazard.deleted" || hazard.active === false) {
            return previous.filter((row) => row.hazard_id !== hazard.hazard_id);
          }
          const without = previous.filter((row) => row.hazard_id !== hazard.hazard_id);
          return [...without, hazard];
        });
      },
      onError: (cause) => setStreamError(cause.message),
    });
  }, [user]);

  // --- Destination from the home screen ------------------------------------
  useEffect(() => {
    if (!network || !destinationParam || initialDestinationHandled.current) return;
    initialDestinationHandled.current = true;
    // A dispatch mission carries coordinates ("lat,lon"); snap them to the
    // nearest road node. Anything else is a place-name search.
    const [lat, lon] = destinationParam.split(",").map(Number);
    const match =
      destinationParam.includes(",") && Number.isFinite(lat) && Number.isFinite(lon)
        ? nearestNode(network.nodes.features, { latitude: lat, longitude: lon })
        : network.nodes.features.find((node) =>
            (node.properties.name ?? "").toLowerCase().includes(destinationParam.toLowerCase()),
          );
    // Opening the screen from a saved destination seeds the search box once.
    setDestinationQuery(match?.properties.name ?? destinationParam);
    if (match) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(match);
    }
  }, [network, destinationParam]);

  // --- Planning ------------------------------------------------------------
  const planRoute = useCallback(
    async (target: NodeFeature, unsafe = false) => {
      if (!network || !position) return;
      const origin = nearestNode(network.nodes.features, position);
      if (!origin) {
        setError("Your location is outside the mapped road network.");
        return;
      }

      plannedFor.current = target.id;
      setPlanning(true);
      setError(null);
      setRefusal(false);
      try {
        const plan = await requestRoute({
          start_node: origin.properties.node_id,
          target_node: target.properties.node_id,
          clearance_cm: clearanceCm,
          ignore_hazards: unsafe,
        });
        void saveCache("route", plan);
        setRoute(plan);
        setSelected(target);
        setDestinationQuery(target.properties.name ?? "");
        setUnsafeRoute(unsafe);
        setArrived(false);
        arrivedRef.current = false;
        setBanner(null);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(true);
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) {
          setRoute(null);
          setRefusal(true);
        } else {
          setError(cause instanceof Error ? cause.message : "Could not plan a route.");
        }
      } finally {
        setPlanning(false);
      }
    },
    [network, position, requestRoute, clearanceCm],
  );

  useEffect(() => {
    if (!selected || !network || !position) return;
    if (plannedFor.current === selected.id) return;
    plannedFor.current = selected.id;
    void planRoute(selected);
  }, [selected, network, position, planRoute]);

  // --- Auto reroute (FSD-FR-060, FSD-FR-061) -------------------------------
  useEffect(() => {
    if (!hazardsInitialised.current) {
      hazardsInitialised.current = true;
      return;
    }
    const current = routeRef.current;
    if (!current || arrivedRef.current) return;

    // Reroute from where the driver actually is, so a hazard behind them does
    // not send them back. Reading position through a ref keeps a GPS tick from
    // re-requesting a route; only a hazard change triggers this.
    const here = positionRef.current;
    const origin =
      here && networkRef.current
        ? nearestNode(networkRef.current.nodes.features, here)
        : null;
    const startNode = origin?.properties.node_id ?? current.start_node;

    const timer = setTimeout(async () => {
      try {
        const next = await requestRoute({
          start_node: startNode,
          target_node: current.target_node,
          clearance_cm: current.vehicle_clearance_cm,
          ignore_hazards: unsafeRef.current,
        });
        void saveCache("route", next);
        if (samePath(current, next)) {
          // Same road, but the hazard list on the returned plan is newer.
          setRoute(next);
          return;
        }
        setRoute(next);
        setArrived(false);
        arrivedRef.current = false;
        setRefusal(false);
        setBanner({
          title: "Route updated",
          body: "Road conditions changed. A safer way to your destination is now shown.",
          tone: "warning",
        });
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) {
          setRoute(null);
          setRefusal(true);
          setBanner({
            title: "No safe route",
            body: "Every verified route is now blocked. Retry or view the unsafe alternative.",
            tone: "danger",
          });
        }
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [hazards, requestRoute]);

  // --- Manual refresh and alternatives (FSD-FR-062) ------------------------
  const refreshRoute = useCallback(async () => {
    const current = routeRef.current;
    if (!current) return;
    const here = positionRef.current;
    const nodes = networkRef.current?.nodes.features ?? [];
    const origin = here ? nearestNode(nodes, here) : null;

    setRefreshing(true);
    try {
      const next = await requestRoute({
        start_node: origin?.properties.node_id ?? current.start_node,
        target_node: current.target_node,
        clearance_cm: current.vehicle_clearance_cm,
        ignore_hazards: unsafeRef.current,
      });
      const changed = !samePath(current, next);
      void saveCache("route", next);
      setRoute(next);
      setRefusal(false);
      if (changed) {
        setArrived(false);
        arrivedRef.current = false;
        setBanner({
          title: "Route updated",
          body: "A fresher route is available with the current road conditions.",
          tone: "warning",
        });
      } else {
        setBanner({
          title: "Route refreshed",
          body: "No change — you are still on the best flood-safe route.",
          tone: "success",
        });
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        setRoute(null);
        setRefusal(true);
        setBanner({
          title: "No safe route",
          body: "Every verified route is now blocked. Retry or view the unsafe alternative.",
          tone: "danger",
        });
      } else {
        setError(cause instanceof Error ? cause.message : "Could not refresh the route.");
      }
    } finally {
      setRefreshing(false);
    }
  }, [requestRoute]);

  // --- Proximity alerts (FSD-FR-063, FSD-FR-064) ---------------------------
  useEffect(() => {
    if (!position || !prefs.hazardAlerts) return;
    for (const hazard of hazards) {
      const ring = polygonRing(hazard.geometry);
      if (ring.length === 0) continue;
      const distance = distanceToPolygonMeters(position, ring);
      const radius = hazard.warning_radius_m || 200;

      if (distance <= radius && !alertedHazards.current.has(hazard.hazard_id)) {
        alertedHazards.current.add(hazard.hazard_id);
        const advice = hazardAdvice(hazard.obstruction_level);
        setBanner({
          title: `Hazard ahead — ${hazard.name}`,
          body: `${advice.label} • ${formatDistance(distance)} away. ${advice.action}`,
          tone: hazard.obstruction_level.toUpperCase() === "CAUTION" ? "warning" : "danger",
        });
      } else if (distance > radius * 1.5) {
        alertedHazards.current.delete(hazard.hazard_id);
      }
    }
  }, [position, hazards, prefs.hazardAlerts]);

  // --- Instruction and arrival advances (FSD-FR-058) ----------------------
  const progress = useMemo(
    () => (route && position ? progressAlongRoute(routeCoordinates(route), position) : null),
    [route, position],
  );

  const currentStep = useMemo(
    () =>
      route && progress
        ? instructionIndexForProgress(route.instructions, progress.progressM)
        : 0,
    [route, progress],
  );

  useEffect(() => {
    if (!route || !progress) return;
    const atDestination =
      progress.distanceToRouteM <= 60 &&
      progress.progressM >= Math.max(progress.totalM - 20, 0);
    if (atDestination && !arrivedRef.current) {
      arrivedRef.current = true;
      // Arrival is announced once, as an announcement rather than derived
      // state; the ref above is what makes it once-only.
      setArrived(true);
      setBanner({
        title: "You have arrived",
        body: route.destination_name ?? selected?.properties.name ?? "Destination reached.",
        tone: "success",
      });
    }
  }, [route, progress, selected]);

  const matches = useMemo(() => {
    const needle = destinationQuery.trim().toLowerCase();
    if (!needle || !network || route) return [];
    return network.nodes.features
      .filter((node) => (node.properties.name ?? "").toLowerCase().includes(needle))
      .slice(0, 8);
  }, [destinationQuery, network, route]);

  const instruction = route?.instructions[currentStep];
  const remaining = progress ? Math.max(progress.totalM - progress.progressM, 0) : null;
  const remainingMinutes =
    route && progress && progress.totalM > 0
      ? route.estimated_travel_time_minutes * (remaining ?? 0) / progress.totalM
      : route?.estimated_travel_time_minutes ?? null;
  const stepRemaining =
    route && progress
      ? remainingOnStep(route.instructions, currentStep, progress.progressM)
      : null;

  const mapHazards = hazards.length > 0 ? hazards : (route?.hazards ?? []);
  const destinationCoordinate = selected
    ? toLatLng(selected.geometry.coordinates)
    : route
      ? toLatLng(route.geometry.coordinates[route.geometry.coordinates.length - 1])
      : null;

  function resetRoute() {
    setRoute(null);
    setSelected(null);
    setDestinationQuery("");
    setRefusal(false);
    setUnsafeRoute(false);
    setArrived(false);
    setBanner(null);
    setError(null);
    setExpanded(true);
    arrivedRef.current = false;
    plannedFor.current = null;
    alertedHazards.current.clear();
  }

  function setSheetExpanded(next: boolean) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(next);
  }

  // A drag of the handle bar beyond a small threshold snaps the sheet open/closed.
  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy < -12) setSheetExpanded(true);
          else if (gesture.dy > 12) setSheetExpanded(false);
        },
      }),
    [],
  );

  // --- Current-step metrics (CR-004/FSD-FR-089-style, from the plan itself) ---
  const currentSegment = useMemo(() => {
    if (!route) return null;
    const instr = route.instructions[currentStep];
    const match = instr
      ? route.segments.find(
          (s) => s.start_node_id === instr.start_node_id && s.end_node_id === instr.end_node_id,
        )
      : null;
    return match ?? route.segments[0] ?? null;
  }, [route, currentStep]);

  const currentEdgeMeta = useMemo(() => {
    if (!currentSegment || !network) return null;
    return (
      network.edges.features.find((e: EdgeFeature) => e.properties.edge_id === currentSegment.edge_id)
        ?.properties ?? null
    );
  }, [currentSegment, network]);

  const safetyMarginCm = currentSegment ? clearanceCm - currentSegment.water_depth_cm : null;
  const congestion = currentEdgeMeta ? congestionFromSpeeds(currentEdgeMeta.avg_speed_kmh, currentEdgeMeta.max_speed_kmh) : null;

  const primaryHazard: RouteHazard | null =
    route?.hazards.find((h) => h.blocking) ?? route?.hazards[0] ?? null;

  if (!user) {
    return (
      <SafeAreaView edges={edges} style={styles.screen}>
        <StatusBar barStyle={mode === "storm" ? "light-content" : "dark-content"} />
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[10] }}>
              <View style={styles.brandIcon}>
                <Waves size={18} color={c.blue600} />
              </View>
              <View>
                <Text style={styles.brandEyebrow}>METROFLOW</Text>
                <Text style={styles.headerTitle}>Active Navigation</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[8] }}>
              <BackButton />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={mode === "storm" ? "Switch to day theme" : "Switch to night/storm theme"}
                onPress={toggleTheme}
                style={styles.themeToggle}
              >
                {mode === "storm" ? <Sun size={18} color={c.slate800} /> : <Moon size={18} color={c.slate800} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={styles.signedOutCard}>
          <ShieldAlert size={28} color={c.blue600} />
          <Text style={styles.signedOutTitle}>Sign In to Navigate</Text>
          <Text style={styles.signedOutBody}>
            Flood-safe routes and live hazard alerts are attached to your driver account.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace("/")}>
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      <StatusBar barStyle={mode === "storm" ? "light-content" : "dark-content"} />

      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space[12] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[10] }}>
            <View style={styles.brandIcon}>
              <Waves size={18} color={c.blue600} />
            </View>
            <View>
              <Text style={styles.brandEyebrow}>METROFLOW</Text>
              <Text style={styles.headerTitle}>Active Navigation</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[12] }}>
            {streamError ? <AlertTriangle size={16} color={c.red600} /> : null}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={mode === "storm" ? "Switch to day theme" : "Switch to night/storm theme"}
              onPress={toggleTheme}
              style={styles.themeToggle}
            >
              {mode === "storm" ? <Sun size={18} color={c.slate800} /> : <Moon size={18} color={c.slate800} />}
            </TouchableOpacity>
            <Avatar name={user?.name || user?.email} size={32} />
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton />
          <View style={styles.headerPill}>
            <Gauge size={12} color={c.blue600} />
            <Text style={styles.headerPillText}>
              {clearanceCm} cm clearance • live hazards
            </Text>
          </View>
        </View>
      </View>

      {!route ? (
        <View style={styles.searchPanel}>
          <View style={styles.searchBox}>
            <MapPin size={16} color={c.blue600} />
            <TextInput
              value={destinationQuery}
              onChangeText={(value) => {
                setDestinationQuery(value);
                setSelected(null);
                plannedFor.current = null;
              }}
              placeholder="Search a road or intersection"
              placeholderTextColor={c.slate400}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {destinationQuery ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Clear destination"
                onPress={() => {
                  setDestinationQuery("");
                  setSelected(null);
                }}
                hitSlop={8}
              >
                <X size={16} color={c.slate400} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Edit vehicle clearance in Profile"
              onPress={() => router.push('/(tabs)/profile')}
              style={[styles.chip, styles.chipDark]}
            >
              <Gauge size={13} color={c.white} />
              <Text style={[styles.chipText, { color: c.white }]}>{clearanceCm} cm clearance</Text>
            </TouchableOpacity>
            <View style={[styles.chip, styles.chipOutline]}>
              <ShieldCheck size={13} color={c.blue600} />
              <Text style={[styles.chipText, { color: c.blue700 }]}>Flood-Free Routes Only</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={prefs.hazardAlerts ? "Turn off water level alerts" : "Turn on water level alerts"}
              onPress={() => void savePrefs({ ...prefs, hazardAlerts: !prefs.hazardAlerts })}
              style={[styles.chip, prefs.hazardAlerts ? styles.chipOutline : styles.chipMuted]}
            >
              <Droplet size={13} color={prefs.hazardAlerts ? c.blue600 : c.slate400} />
              <Text style={[styles.chipText, { color: prefs.hazardAlerts ? c.blue700 : c.slate500 }]}>
                Water Level Alerts
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {planning ? (
            <View style={styles.planningRow}>
              <ActivityIndicator color={c.blue600} />
              <Text style={styles.planningText}>Planning a flood-safe route…</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{error}</Text>
              {selected ? (
                <TouchableOpacity onPress={() => void planRoute(selected)} hitSlop={8}>
                  <Text style={styles.errorRetry}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {refusal && selected ? (
            <View style={styles.refusalCard}>
              <Text style={styles.refusalTitle}>No safe route</Text>
              <Text style={styles.refusalBody}>
                Every verified route to {selected.properties.name ?? "this destination"} is blocked
                for your {clearanceCm} cm clearance.
              </Text>
              <View style={styles.panelButtons}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => void planRoute(selected)}
                >
                  <Text style={styles.secondaryButtonText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={() => void planRoute(selected, true)}
                >
                  <Text style={styles.dangerButtonText}>Show Unsafe Route</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {matches.length > 0 ? (
            <ScrollView style={{ maxHeight: 230 }} keyboardShouldPersistTaps="handled">
              {matches.map((node) => (
                <TouchableOpacity
                  key={node.id}
                  style={styles.resultRow}
                  onPress={() => {
                    setSelected(node);
                    setDestinationQuery(node.properties.name ?? "");
                    setError(null);
                  }}
                >
                  <View style={styles.resultIcon}>
                    <MapPin size={14} color={c.blue600} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{node.properties.name}</Text>
                    <Text style={styles.resultMeta}>Road node {node.properties.node_id}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : destinationQuery && !planning && !refusal ? (
            <Text style={styles.emptyText}>No seeded road node matches that search.</Text>
          ) : (
            <Text style={styles.hintText}>
              Search the seeded corridor by arterial or intersection, for example “C5” or “Shaw”.
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.mapArea}>
        <RouteMap
          ref={mapRef}
          route={route}
          position={position}
          destination={destinationCoordinate}
          destinationName={selected?.properties.name ?? route?.destination_name ?? null}
          hazards={mapHazards}
          edges={network?.edges.features}
          clearanceCm={clearanceCm}
        />

        {route && !expanded ? (
          <View style={styles.statusPill}>
            <View style={styles.statusPillClearance}>
              <Text style={styles.statusPillClearanceText}>{clearanceCm} cm clearance</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
              <View style={[styles.statusDot, { backgroundColor: mapHazards.length > 0 ? c.red500 : c.green600 }]} />
              <Text style={styles.statusPillText}>
                {mapHazards.length > 0 ? "Live hazards active" : "No hazards nearby"}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Hazard details" onPress={() => setSheetExpanded(true)} hitSlop={6}>
              <AlertTriangle size={14} color={c.red600} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={mode === "storm" ? "Switch to day theme" : "Switch to night/storm theme"}
              onPress={toggleTheme}
              hitSlop={6}
            >
              {mode === "storm" ? <Sun size={14} color={c.slate700} /> : <Moon size={14} color={c.slate700} />}
            </TouchableOpacity>
          </View>
        ) : null}

        {!route || expanded ? (
          <View style={styles.vControls}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Centre on my location" onPress={() => mapRef.current?.recenter()} style={styles.controlButton}>
              <LocateFixed size={18} color={c.slate800} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Toggle map theme" onPress={toggleTheme} style={styles.controlButton}>
              <Layers size={18} color={c.slate800} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => mapRef.current?.zoomIn()} style={styles.controlButton}>
              <ZoomIn size={18} color={c.slate800} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => mapRef.current?.zoomOut()} style={styles.controlButton}>
              <ZoomOut size={18} color={c.slate800} />
            </TouchableOpacity>
          </View>
        ) : null}

        {banner ? (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: BANNER_COLORS[banner.tone].background,
                borderColor: BANNER_COLORS[banner.tone].border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: BANNER_COLORS[banner.tone].text }]}>
                {banner.title}
              </Text>
              <Text style={[styles.bannerBody, { color: BANNER_COLORS[banner.tone].text }]}>
                {banner.body}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss alert" onPress={() => setBanner(null)} hitSlop={8}>
              <X size={16} color={BANNER_COLORS[banner.tone].text} />
            </TouchableOpacity>
          </View>
        ) : null}

        {route && instruction && !expanded ? (
          <View style={styles.instructionCard}>
            <View style={styles.instructionIcon}>
              {(() => {
                const ManoeuvreIcon = MANOEUVRE_ICON[instruction.manoeuvre] ?? Navigation;
                return <ManoeuvreIcon size={20} color={c.white} />;
              })()}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.instructionText}>{instruction.text}</Text>
              <Text style={styles.instructionMeta}>
                {instruction.manoeuvre === "ARRIVE"
                  ? "Destination ahead"
                  : stepRemaining !== null
                    ? `in ${formatDistance(stepRemaining)}`
                    : ""}
                {instruction.road_name ? ` • ${instruction.road_name}` : ""}
                {remainingMinutes !== null ? ` • ETA ${formatEta(remainingMinutes)}` : ""}
              </Text>
            </View>
            {speedKmh !== null ? (
              <View style={styles.speedBadge}>
                <Text style={styles.speedBadgeValue}>{Math.round(speedKmh)}</Text>
                <Text style={styles.speedBadgeUnit}>km/h</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {route && !expanded ? (
          <View style={styles.vControlsCompact}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => mapRef.current?.recenter()}
              accessibilityLabel="Centre on my location"
            >
              <LocateFixed size={18} color={c.slate800} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => void refreshRoute()}
              disabled={refreshing}
              accessibilityLabel="Refresh route and alternatives"
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={c.blue600} />
              ) : (
                <RefreshCw size={17} color={c.blue600} />
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {!position && !locationError ? (
          <View style={styles.mapNotice}>
            <ActivityIndicator color={c.blue600} />
            <Text style={styles.mapNoticeText}>Finding your position…</Text>
          </View>
        ) : null}

        {locationError ? (
          <View style={styles.mapNotice}>
            <AlertTriangle size={18} color={c.red600} />
            <Text style={[styles.mapNoticeText, { color: c.red800 }]}>{locationError}</Text>
            {locationPermissionDenied ? (
              <TouchableOpacity onPress={() => void Linking.openSettings()} hitSlop={8}>
                <Text style={[styles.mapNoticeText, { color: c.blue600, fontWeight: "700" }]}>
                  Open Settings
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setLocationError(null);
                  setLocationAttempt((attempt) => attempt + 1);
                }}
                hitSlop={8}
              >
                <Text style={[styles.mapNoticeText, { color: c.blue600, fontWeight: "700" }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      {route ? (
        <View style={styles.routePanel}>
          <View {...sheetPanResponder.panHandlers} style={styles.dragHandleArea}>
            <View style={styles.dragHandleBar} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={expanded ? "Collapse route details" : "Expand route details"}
              onPress={() => setSheetExpanded(!expanded)}
              hitSlop={10}
              style={styles.dragHandleButton}
            >
              {expanded ? <ChevronDown size={16} color={c.slate400} /> : <ChevronUp size={16} color={c.slate400} />}
            </TouchableOpacity>
          </View>

          <ScrollView style={expanded ? styles.sheetScroll : undefined} contentContainerStyle={{ gap: space[10] }}>
          {expanded && instruction ? (
            <View style={styles.sheetInstructionRow}>
              <View style={styles.sheetInstructionIcon}>
                {(() => {
                  const ManoeuvreIcon = MANOEUVRE_ICON[instruction.manoeuvre] ?? Navigation;
                  return <ManoeuvreIcon size={18} color={c.white} />;
                })()}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeDestination} numberOfLines={1}>{instruction.text}</Text>
                <Text style={styles.routeMeta}>
                  {instruction.manoeuvre === "ARRIVE"
                    ? "Destination ahead"
                    : stepRemaining !== null
                      ? `in ${formatDistance(stepRemaining)}`
                      : ""}
                  {instruction.road_name ? ` • ${instruction.road_name}` : ""}
                  {remainingMinutes !== null ? ` • ETA ${formatEta(remainingMinutes)}` : ""}
                </Text>
              </View>
              {speedKmh !== null ? (
                <View style={styles.sheetSpeedBadge}>
                  <Text style={styles.metricValue}>{Math.round(speedKmh)}</Text>
                  <Text style={styles.metricSub}>km/h</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.routeSummary}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeDestination} numberOfLines={1}>
                {route.destination_name ?? selected?.properties.name}
              </Text>
              <Text style={styles.routeMeta}>
                {[
                  remaining !== null ? `${formatDistance(remaining)} remaining` : null,
                  formatDuration(route.estimated_travel_time_minutes),
                  remainingMinutes !== null ? `ETA ${formatEta(remainingMinutes)}` : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            </View>
            {route.hazards.length > 0 ? (
              <View style={styles.hazardChip}>
                <AlertTriangle size={12} color={c.amber700} />
                <Text style={styles.hazardChipText}>
                  {route.hazards.length} hazard{route.hazards.length === 1 ? "" : "s"}
                </Text>
              </View>
            ) : (
              <View style={styles.safeChip}>
                <CheckCircle2 size={12} color={c.green700} />
                <Text style={styles.safeChipText}>Hazard-free</Text>
              </View>
            )}
          </View>

          {expanded && currentSegment ? (
            <View style={styles.metricsGrid}>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>MAX DEPTH</Text>
                <Text style={styles.metricValue}>{currentSegment.water_depth_cm} cm</Text>
                <Text style={styles.metricSub}>
                  ({SEGMENT_STATUS_LABEL[currentSegment.status] ?? currentSegment.status})
                </Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>SAFETY MARGIN</Text>
                <Text
                  style={[
                    styles.metricValue,
                    { color: (safetyMarginCm ?? 0) >= 0 ? c.green700 : c.red700 },
                  ]}
                >
                  {safetyMarginCm !== null ? `${safetyMarginCm >= 0 ? "+" : ""}${safetyMarginCm} cm` : "—"}
                </Text>
                <Text style={styles.metricSub}>clearance</Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>CONGESTION</Text>
                <Text
                  style={[
                    styles.metricValue,
                    {
                      color: !congestion
                        ? c.slate900
                        : congestion.tone === "success"
                          ? c.green700
                          : congestion.tone === "warning"
                            ? c.amber700
                            : c.red700,
                    },
                  ]}
                >
                  {congestion?.label ?? "—"}
                </Text>
              </View>
            </View>
          ) : null}

          {unsafeRoute ? (
            <View style={styles.unsafeNotice}>
              <AlertTriangle size={14} color={c.red700} />
              <Text style={styles.unsafeNoticeText}>
                Unsafe alternative — this route crosses a verified hazard.
              </Text>
            </View>
          ) : null}

          {arrived ? (
            <View style={styles.arrivedRow}>
              <CheckCircle2 size={18} color={c.green600} />
              <Text style={styles.arrivedText}>Arrived at your destination</Text>
            </View>
          ) : null}

          {telemetryVehicleId !== null ? (
            <View style={styles.telemetryStrip}>
              <View style={styles.telemetryItem}>
                <Gauge size={12} color={c.slate400} />
                <Text style={styles.telemetryText}>
                  {speedKmh !== null ? `${Math.round(speedKmh)} km/h` : "— km/h"}
                </Text>
              </View>
              <View style={styles.telemetryItem}>
                <MapPin size={12} color={c.slate400} />
                <Text style={styles.telemetryText}>
                  {gpsAccuracyM !== null ? `±${Math.round(gpsAccuracyM)} m` : "no fix"}
                </Text>
              </View>
              <View style={styles.telemetryItem}>
                <Compass size={12} color={c.slate400} />
                <Text style={styles.telemetryText}>
                  {headingDeg !== null ? `${Math.round(headingDeg)}°` : "—"}
                </Text>
              </View>
              <View style={styles.telemetryItem}>
                {online ? (
                  <Wifi size={12} color={c.green600} />
                ) : (
                  <WifiOff size={12} color={c.red600} />
                )}
                <Text style={styles.telemetryText}>
                  {lastSyncAt
                    ? `Synced ${lastSyncAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
                    : online
                      ? "Not yet synced"
                      : "Offline"}
                </Text>
              </View>
            </View>
          ) : null}

          {expanded && primaryHazard ? (
            <View style={styles.alertCard}>
              <Droplet size={16} color={c.blue700} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertCardTitle}>{primaryHazard.name}</Text>
                <Text style={styles.alertCardBody}>
                  {hazardAdvice(primaryHazard.obstruction_level).label}
                  {primaryHazard.avg_depth_cm !== null ? ` • ${primaryHazard.avg_depth_cm} cm` : ""}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Hazard details"
                onPress={() => {
                  const advice = hazardAdvice(primaryHazard.obstruction_level);
                  setBanner({
                    title: primaryHazard.name,
                    body: `${advice.label}. ${advice.action}`,
                    tone: primaryHazard.blocking ? "danger" : "warning",
                  });
                }}
                hitSlop={8}
              >
                <Text style={styles.alertCardAction}>Details</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.panelButtons}>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetRoute}>
              <Search size={15} color={c.slate800} />
              <Text style={styles.secondaryButtonText}>New Destination</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.endButton}
              onPress={() => {
                void confirm({
                  title: "End navigation?",
                  message: "The route and turn-by-turn instructions are cleared.",
                  confirmLabel: "End Route",
                  destructive: true,
                }).then((confirmed) => {
                  if (!confirmed) return;
                  resetRoute();
                  router.back();
                });
              }}
            >
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(c: ThemeColors, mode: ThemeMode) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.white },
  header: {
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    borderBottomWidth: 1,
    borderColor: c.slate100,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: c.blue100,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
  },
  brandEyebrow: {
    fontSize: fontSize.tiny,
    fontWeight: "800",
    color: c.blue600,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  themeToggle: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.slate50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.slate200,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[6],
    backgroundColor: c.blue50,
    paddingHorizontal: space[12],
    paddingVertical: space[6],
    borderRadius: 999,
  },
  headerPillText: { fontSize: fontSize.caption, fontWeight: "700", color: c.blue800 },
  headerTitle: { fontSize: fontSize.heading, fontWeight: "800", color: c.slate900, lineHeight: 20 },
  mapArea: { flex: 1, position: "relative" },
  banner: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: space[12],
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[10],
  },
  bannerTitle: { fontSize: fontSize.body, fontWeight: "800" },
  bannerBody: { fontSize: fontSize.caption, marginTop: space[2], lineHeight: 15 },
  instructionCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(15,23,42,0.94)",
    borderRadius: 16,
    padding: space[14],
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
  },
  instructionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: c.blue600,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionText: { fontSize: fontSize.lead, fontWeight: "800", color: c.onInk },
  speedBadge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: space[8],
    paddingVertical: space[4],
  },
  speedBadgeValue: { fontSize: fontSize.subtitle, fontWeight: "800", color: c.onInk },
  speedBadgeUnit: { fontSize: fontSize.nano, color: c.inkMuted },
  telemetryStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: c.slate100,
    paddingTop: space[8],
  },
  telemetryItem: { flexDirection: "row", alignItems: "center", gap: space[4] },
  telemetryText: { fontSize: fontSize.micro, color: c.slate500 },
  instructionMeta: { fontSize: fontSize.caption, color: c.inkMuted, marginTop: space[2] },
  mapNotice: {
    position: "absolute",
    top: "45%",
    left: 24,
    right: 24,
    backgroundColor: c.white,
    borderRadius: 14,
    padding: space[14],
    alignItems: "center",
    gap: space[8],
    borderWidth: 1,
    borderColor: c.slate200,
  },
  mapNoticeText: { fontSize: fontSize.body, color: c.slate700, textAlign: "center" },
  controlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.slate200,
  },
  vControls: {
    position: "absolute",
    right: 12,
    top: "38%",
    gap: space[10],
  },
  vControlsCompact: {
    position: "absolute",
    right: 12,
    bottom: 12,
    gap: space[10],
  },
  statusPill: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: space[10],
    backgroundColor: mode === "storm" ? "rgba(11,18,32,0.92)" : "rgba(255,255,255,0.95)",
    borderRadius: 999,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
    borderWidth: 1,
    borderColor: c.slate200,
  },
  statusPillClearance: {
    backgroundColor: c.inkBg,
    borderRadius: 999,
    paddingHorizontal: space[8],
    paddingVertical: space[3],
  },
  statusPillClearanceText: { fontSize: fontSize.micro, fontWeight: "800", color: c.onInk },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: fontSize.micro, fontWeight: "700", color: c.slate700, flexShrink: 1 },
  chipRow: { flexDirection: "row", gap: space[8], paddingTop: space[2] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[5],
    borderRadius: 999,
    paddingHorizontal: space[10],
    paddingVertical: space[6],
    borderWidth: 1,
  },
  chipDark: { backgroundColor: c.inkBg, borderColor: c.inkBg },
  chipOutline: { backgroundColor: c.blue50, borderColor: c.blue200 },
  chipMuted: { backgroundColor: c.slate50, borderColor: c.slate200 },
  chipText: { fontSize: fontSize.caption, fontWeight: "700" },
  dragHandleArea: { alignItems: "center", paddingBottom: space[8] },
  dragHandleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.slate200 },
  dragHandleButton: { position: "absolute", right: 0, top: -4, padding: space[4] },
  sheetScroll: { maxHeight: 420 },
  sheetInstructionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[10],
    backgroundColor: c.slate50,
    borderRadius: 14,
    padding: space[12],
  },
  sheetInstructionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: c.blue600,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSpeedBadge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.slate200,
    paddingHorizontal: space[8],
    paddingVertical: space[4],
  },
  metricsGrid: { flexDirection: "row", gap: space[8] },
  metricCell: {
    flex: 1,
    backgroundColor: c.slate50,
    borderRadius: 12,
    padding: space[10],
    gap: space[2],
  },
  metricLabel: { fontSize: fontSize.nano, fontWeight: "800", color: c.slate400, letterSpacing: 0.4 },
  metricValue: { fontSize: fontSize.label, fontWeight: "800", color: c.slate900 },
  metricSub: { fontSize: fontSize.tiny, color: c.slate500 },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[10],
    backgroundColor: c.blue50,
    borderRadius: 14,
    padding: space[12],
  },
  alertCardTitle: { fontSize: fontSize.label, fontWeight: "800", color: c.slate900 },
  alertCardBody: { fontSize: fontSize.caption, color: c.slate600, marginTop: space[1] },
  alertCardAction: { fontSize: fontSize.caption, fontWeight: "800", color: c.blue700 },
  routePanel: {
    borderTopWidth: 1,
    borderColor: c.slate200,
    padding: space[16],
    gap: space[10],
    backgroundColor: c.white,
  },
  routeSummary: { flexDirection: "row", alignItems: "center", gap: space[10] },
  routeDestination: { fontSize: fontSize.lead, fontWeight: "800", color: c.slate900 },
  routeMeta: { fontSize: fontSize.caption, color: c.slate500, marginTop: space[2] },
  hazardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[4],
    backgroundColor: c.amberSurface,
    borderWidth: 1,
    borderColor: c.amber200,
    paddingHorizontal: space[8],
    paddingVertical: space[4],
    borderRadius: 999,
  },
  hazardChipText: { fontSize: fontSize.micro, fontWeight: "700", color: c.amber800 },
  safeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[4],
    backgroundColor: c.green50,
    borderWidth: 1,
    borderColor: c.green200,
    paddingHorizontal: space[8],
    paddingVertical: space[4],
    borderRadius: 999,
  },
  safeChipText: { fontSize: fontSize.micro, fontWeight: "700", color: c.green700 },
  unsafeNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[6],
    backgroundColor: c.red50,
    borderRadius: 10,
    padding: space[8],
  },
  unsafeNoticeText: { flex: 1, fontSize: fontSize.micro, color: c.red700 },
  arrivedRow: { flexDirection: "row", alignItems: "center", gap: space[8] },
  arrivedText: { fontSize: fontSize.body, fontWeight: "700", color: c.green700 },
  panelButtons: { flexDirection: "row", gap: space[10], marginTop: space[4] },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[6],
    paddingVertical: space[12],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.slate300,
    backgroundColor: c.slate50,
  },
  secondaryButtonText: { fontSize: fontSize.body, fontWeight: "700", color: c.slate800 },
  endButton: {
    paddingHorizontal: space[22],
    paddingVertical: space[12],
    borderRadius: 12,
    backgroundColor: c.inkBg,
    alignItems: "center",
    justifyContent: "center",
  },
  endButtonText: { fontSize: fontSize.body, fontWeight: "800", color: c.onInk },
  searchPanel: {
    borderBottomWidth: 1,
    borderColor: c.slate200,
    padding: space[16],
    gap: space[10],
    backgroundColor: c.white,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[8],
    backgroundColor: c.slate50,
    borderWidth: 1,
    borderColor: c.slate200,
    borderRadius: 14,
    paddingHorizontal: space[12],
    paddingVertical: space[10],
  },
  searchInput: { flex: 1, fontSize: fontSize.label, color: c.slate900 },
  planningRow: { flexDirection: "row", alignItems: "center", gap: space[8] },
  planningText: { fontSize: fontSize.caption, color: c.slate600 },
  errorText: { flex: 1, fontSize: fontSize.caption, color: c.red700 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: space[8] },
  errorRetry: { fontSize: fontSize.caption, fontWeight: "800", color: c.red700 },
  refusalCard: {
    backgroundColor: c.red50,
    borderWidth: 1,
    borderColor: c.red700,
    borderRadius: 14,
    padding: space[12],
    gap: space[6],
  },
  refusalTitle: { fontSize: fontSize.label, fontWeight: "800", color: c.red800 },
  refusalBody: { fontSize: fontSize.caption, color: c.red800, lineHeight: 15 },
  dangerButton: {
    flex: 1.4,
    paddingVertical: space[12],
    borderRadius: 12,
    backgroundColor: c.red700,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: { fontSize: fontSize.body, fontWeight: "700", color: c.white },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[10],
    paddingVertical: space[10],
    borderBottomWidth: 1,
    borderColor: c.slate100,
  },
  resultIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: c.blue50,
    alignItems: "center",
    justifyContent: "center",
  },
  resultName: { fontSize: fontSize.body, fontWeight: "700", color: c.slate800 },
  resultMeta: { fontSize: fontSize.micro, color: c.slate400, marginTop: space[1] },
  emptyText: { fontSize: fontSize.caption, color: c.slate500 },
  hintText: { fontSize: fontSize.caption, color: c.slate500, lineHeight: 16 },
  signedOutCard: {
    margin: space[20],
    padding: space[20],
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.slate200,
    backgroundColor: c.slate50,
    alignItems: "center",
    gap: space[10],
  },
  signedOutTitle: { fontSize: fontSize.subtitle, fontWeight: "800", color: c.slate900 },
  signedOutBody: { fontSize: fontSize.body, color: c.slate600, textAlign: "center", lineHeight: 17 },
  primaryButton: {
    marginTop: space[6],
    paddingHorizontal: space[28],
    paddingVertical: space[12],
    borderRadius: 12,
    backgroundColor: c.inkBg,
  },
  primaryButtonText: { fontSize: fontSize.label, fontWeight: "800", color: c.onInk },
  });
}
