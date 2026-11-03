import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldAlert,
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
import { loadCache, saveCache } from "../offline";
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

import { colors } from '../theme';
const DRIVER_CLEARANCE_CM = 28;

type Banner = {
  title: string;
  body: string;
  tone: "warning" | "danger" | "success";
} | null;

const BANNER_COLORS = {
  warning: { background: "#fffbeb", border: "#f59e0b", text: colors.amber800 },
  danger: { background: colors.red50, border: colors.red600, text: colors.red800 },
  success: { background: "#f0fdf4", border: colors.green600, text: "#166534" },
} as const;

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

function samePath(a: RoutePlan, b: RoutePlan) {
  return a.optimal_path_nodes.join(",") === b.optimal_path_nodes.join(",");
}

export default function RouteScreen({ edges }: { edges?: Edge[] } = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const { destination: destinationParam } = useLocalSearchParams<{ destination?: string }>();

  const [network, setNetwork] = useState<NetworkState | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
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
  const unsafeRef = useRef(false);
  const plannedFor = useRef<number | null>(null);
  const initialDestinationHandled = useRef(false);
  const hazardsInitialised = useRef(false);
  const arrivedRef = useRef(false);
  const alertedHazards = useRef<Set<number>>(new Set());
  // Telemetry: track the wall-clock time of the last successful ping so we
  // respect the server-side 5-second throttle without duplicating its logic
  // (FSD-FR-072, VAL-020).  Vehicle identity is not yet stored in the JWT
  // (pilot gap); the sender is wired but skipped until vehicleId is available.
  const lastTelemetrySentMs = useRef<number>(0);
  // NOTE: vehicle_id is not yet surfaced in the auth token (pilot scope).
  // Set TELEMETRY_VEHICLE_ID via EXPO_PUBLIC_TELEMETRY_VEHICLE_ID to enable
  // live telemetry from a specific vehicle (FSD-FR-072).
  const TELEMETRY_VEHICLE_ID: number | null = process.env
    .EXPO_PUBLIC_TELEMETRY_VEHICLE_ID
    ? Number(process.env.EXPO_PUBLIC_TELEMETRY_VEHICLE_ID)
    : null;

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
    unsafeRef.current = unsafeRoute;
  }, [unsafeRoute]);

  // --- Location ------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          if (!cancelled) setLocationError("Location permission is required for navigation.");
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude });
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

            // --- Telemetry sender (FSD-FR-072) --------------------------------
            // Fire-and-forget: only while actively navigating and only when a
            // vehicle id is configured (pilot constraint).
            if (TELEMETRY_VEHICLE_ID !== null && routeRef.current !== null) {
              const nowMs = Date.now();
              if (nowMs - lastTelemetrySentMs.current >= 5000) {
                lastTelemetrySentMs.current = nowMs;
                postTelemetry(TELEMETRY_VEHICLE_ID, {
                  latitude: update.coords.latitude,
                  longitude: update.coords.longitude,
                  speed_kmh:
                    update.coords.speed != null
                      ? update.coords.speed * 3.6
                      : null,
                  heading: update.coords.heading ?? null,
                  recorded_at: new Date(update.timestamp).toISOString(),
                }).catch(() => {
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
  }, [user]);

  // --- Road network --------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getNetworkState(DRIVER_CLEARANCE_CM)
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
  }, [user]);

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
    const needle = destinationParam.toLowerCase();
    const match = network.nodes.features.find((node) =>
      (node.properties.name ?? "").toLowerCase().includes(needle),
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
        const plan = await getRoute({
          start_node: origin.properties.node_id,
          target_node: target.properties.node_id,
          clearance_cm: DRIVER_CLEARANCE_CM,
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
    [network, position],
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
        const next = await getRoute({
          start_node: startNode,
          target_node: current.target_node,
          clearance_cm: current.vehicle_clearance_cm,
          ignore_hazards: unsafeRef.current,
        });
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
  }, [hazards]);

  // --- Manual refresh and alternatives (FSD-FR-062) ------------------------
  const refreshRoute = useCallback(async () => {
    const current = routeRef.current;
    if (!current) return;
    const here = positionRef.current;
    const nodes = networkRef.current?.nodes.features ?? [];
    const origin = here ? nearestNode(nodes, here) : null;

    setRefreshing(true);
    try {
      const next = await getRoute({
        start_node: origin?.properties.node_id ?? current.start_node,
        target_node: current.target_node,
        clearance_cm: current.vehicle_clearance_cm,
        ignore_hazards: unsafeRef.current,
      });
      const changed = !samePath(current, next);
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
  }, []);

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
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={18} color={colors.slate800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Navigation</Text>
        </View>
        <View style={styles.signedOutCard}>
          <ShieldAlert size={28} color={colors.blue600} />
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
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={18} color={colors.slate800} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Navigation</Text>
          <Text style={styles.headerSubtitle}>
            {DRIVER_CLEARANCE_CM} cm clearance • live hazards
          </Text>
        </View>
        {streamError ? <AlertTriangle size={16} color={colors.red600} /> : null}
      </View>

      {!route ? (
        <View style={styles.searchPanel}>
          <View style={styles.searchBox}>
            <MapPin size={16} color={colors.blue600} />
            <TextInput
              value={destinationQuery}
              onChangeText={(value) => {
                setDestinationQuery(value);
                setSelected(null);
                plannedFor.current = null;
              }}
              placeholder="Search a road or intersection"
              placeholderTextColor={colors.slate400}
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
                <X size={16} color={colors.slate400} />
              </TouchableOpacity>
            ) : null}
          </View>

          {planning ? (
            <View style={styles.planningRow}>
              <ActivityIndicator color={colors.blue600} />
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
                for your {DRIVER_CLEARANCE_CM} cm clearance.
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
                    <MapPin size={14} color={colors.blue600} />
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
              <Navigation size={20} color={colors.white} />
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
              <ActivityIndicator size="small" color={colors.blue600} />
            ) : (
              <RefreshCw size={17} color={colors.blue600} />
            )}
          </TouchableOpacity>
        ) : null}

        {!position && !locationError ? (
          <View style={styles.mapNotice}>
            <ActivityIndicator color={colors.blue600} />
            <Text style={styles.mapNoticeText}>Finding your position…</Text>
          </View>
        ) : null}

        {locationError ? (
          <View style={styles.mapNotice}>
            <AlertTriangle size={18} color={colors.red600} />
            <Text style={[styles.mapNoticeText, { color: colors.red800 }]}>{locationError}</Text>
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
                <CheckCircle2 size={12} color={colors.green700} />
                <Text style={styles.safeChipText}>Hazard-free</Text>
              </View>
            )}
          </View>

          {unsafeRoute ? (
            <View style={styles.unsafeNotice}>
              <AlertTriangle size={14} color={colors.red700} />
              <Text style={styles.unsafeNoticeText}>
                Unsafe alternative — this route crosses a verified hazard.
              </Text>
            </View>
          ) : null}

          {arrived ? (
            <View style={styles.arrivedRow}>
              <CheckCircle2 size={18} color={colors.green600} />
              <Text style={styles.arrivedText}>Arrived at your destination</Text>
            </View>
          ) : null}

          <View style={styles.panelButtons}>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetRoute}>
              <Search size={15} color={colors.slate800} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.slate100,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.slate50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  headerTitle: { fontSize: 15, fontWeight: "800", color: colors.slate900 },
  headerSubtitle: { fontSize: 10, color: colors.slate500, marginTop: 1 },
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
    backgroundColor: colors.blue600,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionText: { fontSize: 14, fontWeight: "800", color: colors.white },
  instructionMeta: { fontSize: 11, color: colors.slate300, marginTop: 2 },
  mapNotice: {
    position: "absolute",
    top: "45%",
    left: 24,
    right: 24,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  mapNoticeText: { fontSize: 12, color: colors.slate700, textAlign: "center" },
  refreshButton: {
    position: "absolute",
    right: 12,
    bottom: 88,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  routePanel: {
    borderTopWidth: 1,
    borderColor: colors.slate200,
    padding: 16,
    gap: 10,
    backgroundColor: colors.white,
  },
  routeSummary: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeDestination: { fontSize: 14, fontWeight: "800", color: colors.slate900 },
  routeMeta: { fontSize: 11, color: colors.slate500, marginTop: 2 },
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
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  safeChipText: { fontSize: 10, fontWeight: "700", color: colors.green700 },
  unsafeNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.red50,
    borderRadius: 10,
    padding: 8,
  },
  unsafeNoticeText: { flex: 1, fontSize: 10, color: colors.red700 },
  arrivedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  arrivedText: { fontSize: 12, fontWeight: "700", color: colors.green700 },
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
    borderColor: colors.slate300,
    backgroundColor: colors.slate50,
  },
  secondaryButtonText: { fontSize: 12, fontWeight: "700", color: colors.slate800 },
  endButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.slate900,
    alignItems: "center",
    justifyContent: "center",
  },
  endButtonText: { fontSize: 12, fontWeight: "800", color: colors.white },
  searchPanel: {
    borderBottomWidth: 1,
    borderColor: colors.slate200,
    padding: 16,
    gap: 10,
    backgroundColor: colors.white,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.slate900 },
  planningRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planningText: { fontSize: 11, color: colors.slate600 },
  errorText: { flex: 1, fontSize: 11, color: colors.red700 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  errorRetry: { fontSize: 11, fontWeight: "800", color: colors.red700 },
  refusalCard: {
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  refusalTitle: { fontSize: 13, fontWeight: "800", color: colors.red800 },
  refusalBody: { fontSize: 11, color: "#7f1d1d", lineHeight: 15 },
  dangerButton: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.red700,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: { fontSize: 12, fontWeight: "700", color: colors.white },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.slate100,
  },
  resultIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.blue50,
    alignItems: "center",
    justifyContent: "center",
  },
  resultName: { fontSize: 12, fontWeight: "700", color: colors.slate800 },
  resultMeta: { fontSize: 10, color: colors.slate400, marginTop: 1 },
  emptyText: { fontSize: 11, color: colors.slate500 },
  hintText: { fontSize: 11, color: colors.slate500, lineHeight: 16 },
  signedOutCard: {
    margin: 20,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate50,
    alignItems: "center",
    gap: 10,
  },
  signedOutTitle: { fontSize: 15, fontWeight: "800", color: colors.slate900 },
  signedOutBody: { fontSize: 12, color: colors.slate600, textAlign: "center", lineHeight: 17 },
  primaryButton: {
    marginTop: 6,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.slate900,
  },
  primaryButtonText: { fontSize: 13, fontWeight: "800", color: colors.white },
});
