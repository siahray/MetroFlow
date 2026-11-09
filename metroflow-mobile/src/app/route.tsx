import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Sun,
  Gauge,
  MapPin,
  Moon,
  Navigation,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";

import {
  ApiError,
  getNetworkState,
  getRoute,
  type HazardInfo,
  type NetworkState,
  type NodeFeature,
  type RoutePlan,
  postTelemetry,
} from "../api";
import { useAuth } from "../auth";
import { RouteMap } from "../navigation/RouteMap";
import { subscribeToHazards } from "../navigation/hazard-stream";
import { planRouteOffline } from "../navigation/offline-route";
import { loadCache, saveCache, useOnline } from "../offline";
import { loadMyVehicle } from "../myVehicle";
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

import { useTheme, type ThemeColors, type ThemeMode } from '../theme';

type Banner = {
  title: string;
  body: string;
  tone: "warning" | "danger" | "success";
} | null;

function bannerColors(c: ThemeColors, mode: ThemeMode) {
  return {
    warning: { background: mode === "storm" ? "#3a2a06" : "#fffbeb", border: "#f59e0b", text: c.amber800 },
    danger: { background: c.red50, border: c.red600, text: c.red800 },
    success: {
      background: mode === "storm" ? "#052e1b" : "#f0fdf4",
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

export default function RouteScreen({ edges }: { edges?: Edge[] } = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const { c, mode, toggle: toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(c, mode), [c, mode]);
  const BANNER_COLORS = useMemo(() => bannerColors(c, mode), [c, mode]);
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
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const online = useOnline();
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

  const routeRef = useRef<RoutePlan | null>(null);
  const positionRef = useRef<LatLng | null>(null);
  const networkRef = useRef<NetworkState | null>(null);
  const hazardsRef = useRef<HazardInfo[]>([]);
  const unsafeRef = useRef(false);
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

            // --- Telemetry sender (FSD-FR-072) --------------------------------
            // Fire-and-forget: only while actively navigating as a linked unit.
            if (telemetryVehicleId !== null && routeRef.current !== null) {
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
    if (!position) return;
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
  }, [position, hazards]);

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
    arrivedRef.current = false;
    plannedFor.current = null;
    alertedHazards.current.clear();
  }

  if (!user) {
    return (
      <SafeAreaView edges={edges} style={styles.screen}>
        <StatusBar barStyle={mode === "storm" ? "light-content" : "dark-content"} />
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={18} color={c.slate800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Navigation</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={mode === "storm" ? "Switch to day theme" : "Switch to night/storm theme"}
            onPress={toggleTheme}
            style={styles.backButton}
          >
            {mode === "storm" ? <Sun size={18} color={c.slate800} /> : <Moon size={18} color={c.slate800} />}
          </TouchableOpacity>
        </View>
        <View style={styles.signedOutCard}>
          <ShieldAlert size={28} color={c.blue600} />
          <Text style={styles.signedOutTitle}>Sign in to navigate</Text>
          <Text style={styles.signedOutBody}>
            Flood-safe routes and live hazard alerts are attached to your driver account.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace("/")}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      <StatusBar barStyle={mode === "storm" ? "light-content" : "dark-content"} />

      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={18} color={c.slate800} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Navigation</Text>
          <Text style={styles.headerSubtitle}>
            {clearanceCm} cm clearance • live hazards
          </Text>
        </View>
        {streamError ? <AlertTriangle size={16} color={c.red600} /> : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={mode === "storm" ? "Switch to day theme" : "Switch to night/storm theme"}
          onPress={toggleTheme}
          style={styles.backButton}
        >
          {mode === "storm" ? <Sun size={18} color={c.slate800} /> : <Moon size={18} color={c.slate800} />}
        </TouchableOpacity>
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
                  <Text style={styles.dangerButtonText}>Show unsafe route</Text>
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
          route={route}
          position={position}
          destination={destinationCoordinate}
          destinationName={selected?.properties.name ?? route?.destination_name ?? null}
          hazards={mapHazards}
          edges={network?.edges.features}
        />

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

        {route && instruction ? (
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

        {route ? (
          <TouchableOpacity
            style={styles.refreshButton}
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
                <AlertTriangle size={12} color="#b45309" />
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

          <View style={styles.panelButtons}>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetRoute}>
              <Search size={15} color={c.slate800} />
              <Text style={styles.secondaryButtonText}>New destination</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.endButton}
              onPress={() => {
                resetRoute();
                router.back();
              }}
            >
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(c: ThemeColors, mode: ThemeMode) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: c.slate100,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.slate50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.slate200,
  },
  headerTitle: { fontSize: 15, fontWeight: "800", color: c.slate900 },
  headerSubtitle: { fontSize: 10, color: c.slate500, marginTop: 1 },
  mapArea: { flex: 1, position: "relative" },
  banner: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bannerTitle: { fontSize: 12, fontWeight: "800" },
  bannerBody: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  instructionCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(15,23,42,0.94)",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  instructionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: c.blue600,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionText: { fontSize: 14, fontWeight: "800", color: c.onInk },
  speedBadge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  speedBadgeValue: { fontSize: 15, fontWeight: "800", color: c.onInk },
  speedBadgeUnit: { fontSize: 8, color: c.inkMuted },
  telemetryStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: c.slate100,
    paddingTop: 8,
  },
  telemetryItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  telemetryText: { fontSize: 10, color: c.slate500 },
  instructionMeta: { fontSize: 11, color: c.inkMuted, marginTop: 2 },
  mapNotice: {
    position: "absolute",
    top: "45%",
    left: 24,
    right: 24,
    backgroundColor: c.white,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: c.slate200,
  },
  mapNoticeText: { fontSize: 12, color: c.slate700, textAlign: "center" },
  refreshButton: {
    position: "absolute",
    right: 12,
    bottom: 88,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.slate200,
  },
  routePanel: {
    borderTopWidth: 1,
    borderColor: c.slate200,
    padding: 16,
    gap: 10,
    backgroundColor: c.white,
  },
  routeSummary: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeDestination: { fontSize: 14, fontWeight: "800", color: c.slate900 },
  routeMeta: { fontSize: 11, color: c.slate500, marginTop: 2 },
  hazardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  hazardChipText: { fontSize: 10, fontWeight: "700", color: "#b45309" },
  safeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: mode === "storm" ? "#052e1b" : "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  safeChipText: { fontSize: 10, fontWeight: "700", color: c.green700 },
  unsafeNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.red50,
    borderRadius: 10,
    padding: 8,
  },
  unsafeNoticeText: { flex: 1, fontSize: 10, color: c.red700 },
  arrivedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  arrivedText: { fontSize: 12, fontWeight: "700", color: c.green700 },
  panelButtons: { flexDirection: "row", gap: 10, marginTop: 4 },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.slate300,
    backgroundColor: c.slate50,
  },
  secondaryButtonText: { fontSize: 12, fontWeight: "700", color: c.slate800 },
  endButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: c.inkBg,
    alignItems: "center",
    justifyContent: "center",
  },
  endButtonText: { fontSize: 12, fontWeight: "800", color: c.onInk },
  searchPanel: {
    borderBottomWidth: 1,
    borderColor: c.slate200,
    padding: 16,
    gap: 10,
    backgroundColor: c.white,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.slate50,
    borderWidth: 1,
    borderColor: c.slate200,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: c.slate900 },
  planningRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planningText: { fontSize: 11, color: c.slate600 },
  errorText: { flex: 1, fontSize: 11, color: c.red700 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  errorRetry: { fontSize: 11, fontWeight: "800", color: c.red700 },
  refusalCard: {
    backgroundColor: c.red50,
    borderWidth: 1,
    borderColor: c.red700,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  refusalTitle: { fontSize: 13, fontWeight: "800", color: c.red800 },
  refusalBody: { fontSize: 11, color: c.red800, lineHeight: 15 },
  dangerButton: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: c.red700,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: { fontSize: 12, fontWeight: "700", color: c.white },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
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
  resultName: { fontSize: 12, fontWeight: "700", color: c.slate800 },
  resultMeta: { fontSize: 10, color: c.slate400, marginTop: 1 },
  emptyText: { fontSize: 11, color: c.slate500 },
  hintText: { fontSize: 11, color: c.slate500, lineHeight: 16 },
  signedOutCard: {
    margin: 20,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.slate200,
    backgroundColor: c.slate50,
    alignItems: "center",
    gap: 10,
  },
  signedOutTitle: { fontSize: 15, fontWeight: "800", color: c.slate900 },
  signedOutBody: { fontSize: 12, color: c.slate600, textAlign: "center", lineHeight: 17 },
  primaryButton: {
    marginTop: 6,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: c.inkBg,
  },
  primaryButtonText: { fontSize: 13, fontWeight: "800", color: c.onInk },
  });
}
