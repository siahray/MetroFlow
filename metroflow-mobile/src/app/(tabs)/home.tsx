import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import {
  Waves,
  ShieldCheck,
  WifiOff,
  LifeBuoy,
  Navigation,
  Gauge,
  Truck,
  Bike,
  Car,
  CarFront,
  Pencil,
  RefreshCw,
  Route as RouteIcon,
  ArrowRight,
  Wifi,
  AlertTriangle,
  Ban,
  CloudRain,
  CloudOff,
  Droplets,
  Wind,
  MapPin,
} from 'lucide-react-native';

import {
  arriveSOS,
  getCurrentWeather,
  getFloodState,
  getMission,
  listActiveHazards,
  listVehicles,
  resolveSOS,
  type CurrentWeather,
  type FloodStateResponse,
  type HazardInfo,
  type SOSRequest,
  type Vehicle,
} from '../../api';
import { useAuth } from '../../auth';
import { Avatar } from '../../components/Avatar';
import { useDialog } from '../../components/Dialog';
import { reverseGeocodeCity } from '../../geocode';

import { QuickPickList } from '../../components/QuickPicks';
import { loadCache, saveCache, useOnline, usePendingReports } from '../../offline';
import { loadActiveGarageVehicle, type GarageVehicle, type VehicleType } from '../../myVehicle';
import { fontSize, space, useTheme, type ThemeColors } from '../../theme';

function vehicleStatusColor(c: ThemeColors): Record<string, string> {
  return {
    AVAILABLE: c.green700,
    DISPATCHED: c.red700,
    EN_ROUTE: c.red700,
    MAINTENANCE: c.amber800,
  };
}

const MY_VEHICLE_ICON: Record<VehicleType, typeof Car> = {
  motorcycle: Bike,
  sedan: Car,
  suv: CarFront,
  truck: Truck,
};
/** Relative age of an ISO timestamp, for the advisory card ("12m ago"). */
function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Caution line for the weather card's advisory section, keyed by the backend's WMO description. */
const WET_ADVISORY_MESSAGE: Record<string, string> = {
  Drizzle: 'Light rain in the area — expect wet roads.',
  'Freezing drizzle': 'Freezing drizzle in the area — icy patches possible.',
  Rain: 'Rain in the area — expect wet, slower roads.',
  'Freezing rain': 'Freezing rain in the area — icy, hazardous roads possible.',
  'Rain showers': 'Rain showers in the area — expect wet, slower roads.',
  Thunderstorm: 'Thunderstorm in the area — drive with caution.',
  Snow: 'Snow in the area — expect slippery roads.',
  'Snow showers': 'Snow showers in the area — expect slippery roads.',
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { confirm, notice } = useDialog();

  const [hazards, setHazards] = useState<HazardInfo[] | null>(null);
  const [floodState, setFloodState] = useState<FloodStateResponse | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mission, setMission] = useState<SOSRequest | null>(null);
  const [closing, setClosing] = useState(false);
  // On-scene is its own milestone now: "Mark arrived" records ARRIVED, then
  // "Close incident" resolves. Reset whenever the mission changes -- adjusted
  // during render (React's documented pattern) rather than in an effect, so
  // there's no extra render pass between the mission changing and the reset.
  const [sceneMarked, setSceneMarked] = useState(false);
  const missionId = mission?.sos_id ?? null;
  const [trackedMissionId, setTrackedMissionId] = useState(missionId);
  if (missionId !== trackedMissionId) {
    setTrackedMissionId(missionId);
    setSceneMarked(false);
  }
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [myVehicle, setMyVehicle] = useState<GarageVehicle | null>(null);
  const [currentWeather, setCurrentWeather] = useState<CurrentWeather | null>(null);
  const [weatherPlace, setWeatherPlace] = useState<string | null>(null);
  const online = useOnline();
  const pendingReports = usePendingReports();
  const { c, mode } = useTheme();
  const VEHICLE_STATUS_COLOR = vehicleStatusColor(c);

  const displayName = user?.name || user?.email || 'Guest';
  const firstName = displayName.split(/[\s@]/)[0];
  const vehicleId = user?.vehicle_id ?? null;

  // The fleet rescue unit this emergency driver reports as — not the public driver's own vehicle.
  useEffect(() => {
    if (vehicleId === null) return;
    listVehicles()
      .then((list) => setVehicle(list.find((v) => v.vehicle_id === vehicleId) ?? null))
      .catch(() => setVehicle(null));
  }, [vehicleId]);

  // The public driver's own vehicle, configured in Profile — reload whenever Home regains focus.
  useFocusEffect(
    useCallback(() => {
      void loadActiveGarageVehicle().then(setMyVehicle);
    }, []),
  );

  // Current conditions at the driver's own location — check-only permission
  // (never prompts on its own) so loading Home doesn't surprise anyone with a
  // location dialog; falls back to silence, same as the forecast card.
  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const current =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!current) return;
        const { latitude, longitude } = current.coords;
        void getCurrentWeather(latitude, longitude).then(setCurrentWeather).catch(() => {});
        void reverseGeocodeCity(latitude, longitude).then(setWeatherPlace).catch(() => {});
      } catch {
        // Leave the card unavailable; the quiet-advisory card still shows below.
      }
    })();
  }, []);

  const load = useCallback(
    () =>
      listActiveHazards()
        .then((fresh) => {
          setHazards(fresh);
          setUpdatedAt(new Date());
          setOffline(false);
          void saveCache('hazards', fresh);
        })
        .catch(async () => {
          // No connection: show the last saved hazards instead of nothing (FSD-FR-070).
          setHazards(await loadCache<HazardInfo[]>('hazards'));
          setOffline(true);
        }),
    [],
  );

  // Road closures and the live advisory source (CR-004). No offline cache: this
  // is supplementary and the card falls back to an unavailable state instead.
  const loadFloodState = useCallback(
    () => getFloodState(true).then(setFloodState).catch(() => setFloodState(null)),
    [],
  );

  // The dispatcher assigns a unit in the portal; the unit polls its own mission
  // (FSD-FR-074) because there is no driver-facing stream.
  const loadMission = useCallback(
    () =>
      vehicleId === null
        ? Promise.resolve()
        : getMission(vehicleId)
            .then(setMission)
            .catch(() => {
              // Keep whatever is on screen; the next poll or pull-to-refresh retries.
            }),
    [vehicleId],
  );

  // Load on mount and again whenever the connection returns.
  useEffect(() => {
    if (!online) return;
    load();
    void loadFloodState();
    void loadMission();
    const timer = setInterval(() => void loadMission(), 10000);
    return () => clearInterval(timer);
  }, [online, load, loadFloodState, loadMission]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([load(), loadFloodState(), loadMission()]);
    setRefreshing(false);
  }

  async function handleArrived() {
    if (!mission) return;
    const confirmed = await confirm({
      title: 'Mark arrival?',
      message: `Dispatch sees incident #${mission.sos_id} as reached once you confirm.`,
      confirmLabel: 'Mark Arrived',
    });
    if (!confirmed) return;
    setClosing(true);
    try {
      await arriveSOS(mission.sos_id);
      setSceneMarked(true);
    } catch {
      await notice({
        title: 'Could not mark arrival',
        message: 'The server did not confirm. Try again.',
        tone: 'danger',
      });
    } finally {
      setClosing(false);
    }
  }

  async function handleResolve() {
    if (!mission) return;
    const confirmed = await confirm({
      title: 'Close incident?',
      message: `Incident #${mission.sos_id} is cleared from your unit and cannot be reopened.`,
      confirmLabel: 'Close Incident',
      destructive: true,
    });
    if (!confirmed) return;
    setClosing(true);
    try {
      await resolveSOS(mission.sos_id);
      setMission(null);
      setSceneMarked(false);
    } catch {
      await notice({
        title: 'Could not close the incident',
        message: 'The server did not confirm. Try again.',
        tone: 'danger',
      });
    } finally {
      setClosing(false);
    }
  }

  const activeHazards = hazards ? hazards.length : null;
  const closedRoads = floodState ? floodState.edges.filter((e) => e.closes_road).length : null;
  const syncLabel = pendingReports === 0 ? 'Synced' : `${pendingReports} pending`;

  // The advisory card is driven entirely by the driver's own current-weather
  // reading, not the road-network flood-state resolver.
  const weatherAdvisoryMessage = currentWeather?.available
    ? WET_ADVISORY_MESSAGE[currentWeather.description ?? '']
    : undefined;

  const card = {
    backgroundColor: c.white,
    borderRadius: 16,
    shadowColor: c.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  } as const;

  // Advisory content only, keyed off the current-weather reading above it —
  // shared by the merged weather card and its standalone fallback.
  const advisoryBody = weatherAdvisoryMessage ? (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: c.blue100,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CloudRain size={20} color={c.blue700} />
        </View>
        <Text style={{ fontSize: fontSize.body, fontWeight: '800', color: c.blue700 }} numberOfLines={1}>
          Open-Meteo Weather
          {timeAgo(currentWeather?.as_of ?? null) ? ` · ${timeAgo(currentWeather?.as_of ?? null)}` : ''}
        </Text>
      </View>
      <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: c.slate900 }}>
        {currentWeather?.description} Advisory
      </Text>
      <Text style={{ fontSize: fontSize.lead, color: c.slate600 }}>{weatherAdvisoryMessage}</Text>
    </>
  ) : (
    <>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: c.slate100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CloudOff size={20} color={c.slate400} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: c.slate900 }}>
          No Active Weather Advisory
        </Text>
        <Text style={{ fontSize: fontSize.body, color: c.slate500, marginTop: space[2] }}>
          {currentWeather?.available
            ? `${currentWeather.description ?? 'Clear'} conditions — nothing to flag right now.`
            : 'Advisory data unavailable right now.'}
        </Text>
      </View>
    </>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.white }}>
      <StatusBar barStyle={mode === 'storm' ? 'light-content' : 'dark-content'} />

      <View
        style={{
          paddingHorizontal: space[20],
          paddingVertical: space[12],
          borderBottomWidth: 1,
          borderColor: c.slate100,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: c.white,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: c.blue100,
              backgroundColor: c.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Waves size={22} color={c.blue600} />
          </View>
          <View>
            <Text style={{ fontSize: fontSize.caption, fontWeight: '800', color: c.blue600, letterSpacing: 0.8 }}>
              METROFLOW
            </Text>
            <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: c.slate900 }}>Home</Text>
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Avatar name={user?.name || user?.email} size={40} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: c.slate50 }}
        contentContainerStyle={{ padding: space[20], gap: space[16], flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Personalized greeting */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
          <View style={{ flex: 1, gap: space[6] }}>
            {user ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: space[4],
                  backgroundColor: c.blue50,
                  borderRadius: 999,
                  paddingHorizontal: space[10],
                  paddingVertical: space[4],
                }}
              >
                <ShieldCheck size={13} color={c.blue600} />
                <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: c.blue700 }}>
                  Civic Commuter Verified
                </Text>
              </View>
            ) : null}
            <Text style={{ fontSize: fontSize.jumbo, fontWeight: '800', color: c.slate900 }} numberOfLines={1}>
              Good day, {firstName}!
            </Text>
            <Text style={{ fontSize: fontSize.lead, color: c.slate500 }}>Where are you heading today?</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Refresh live data"
            onPress={handleRefresh}
            disabled={refreshing}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: c.blue600,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <RefreshCw size={20} color={c.white} />
          </TouchableOpacity>
        </View>

        {/* Dispatch: the incident this unit was assigned in the portal */}
        {mission && vehicleId !== null && (
          <View
            style={{
              ...card,
              backgroundColor: c.red50,
              borderWidth: 1,
              borderColor: c.red500,
              padding: space[16],
              gap: space[12],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
              <LifeBuoy size={20} color={c.red700} />
              <Text style={{ flex: 1, fontSize: fontSize.lead, fontWeight: '800', color: c.red700 }}>
                Dispatched: Incident #{mission.sos_id}
              </Text>
            </View>
            <Text style={{ fontSize: fontSize.body, color: c.slate700 }}>
              Scene at {mission.latitude.toFixed(4)}° N, {mission.longitude.toFixed(4)}° E
            </Text>
            {mission.note ? (
              <Text style={{ fontSize: fontSize.body, color: c.slate700 }} numberOfLines={2}>
                {mission.note}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space[10] }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Navigate to the assigned incident"
                onPress={() =>
                  router.push({
                    pathname: '/map',
                    params: { destination: `${mission.latitude},${mission.longitude}` },
                  })
                }
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space[6],
                  backgroundColor: c.slate900,
                  borderRadius: 10,
                  paddingVertical: space[12],
                }}
              >
                <Navigation size={16} color={c.white} />
                <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: c.white }}>
                  Navigate
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  sceneMarked ? 'Close the incident' : 'Mark the incident as reached'
                }
                disabled={closing}
                onPress={sceneMarked ? handleResolve : handleArrived}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: c.red500,
                  borderRadius: 10,
                  paddingVertical: space[12],
                  opacity: closing ? 0.6 : 1,
                }}
              >
                <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: c.red700 }}>
                  {closing ? 'Working…' : sceneMarked ? 'Close Incident' : 'Mark Arrived'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Network and road status overview */}
        <View style={{ flexDirection: 'row', gap: space[10] }}>
          <View style={{ ...card, flex: 1, padding: space[14], gap: space[8] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[5] }}>
              {offline || !online ? (
                <WifiOff size={15} color={c.amber800} />
              ) : (
                <Wifi size={15} color={c.emerald600} />
              )}
              <Text style={{ fontSize: fontSize.body, fontWeight: '800', color: c.slate900 }} numberOfLines={1}>
                Live Sync
              </Text>
            </View>
            <Text style={{ fontSize: fontSize.caption, color: c.slate500 }} numberOfLines={2}>
              {online && !offline ? 'Online' : 'Offline'} · {syncLabel}
            </Text>
          </View>

          <View style={{ ...card, flex: 1, padding: space[14], gap: space[8] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[5] }}>
              <AlertTriangle size={15} color={c.amber600} />
              <Text style={{ fontSize: fontSize.body, fontWeight: '800', color: c.slate900 }} numberOfLines={1}>
                {activeHazards ?? '—'} Active
              </Text>
            </View>
            <Text style={{ fontSize: fontSize.caption, color: c.slate500 }} numberOfLines={2}>
              Hazards
            </Text>
          </View>

          <View style={{ ...card, flex: 1, padding: space[14], gap: space[8] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[5] }}>
              {closedRoads ? (
                <Ban size={15} color={c.red600} />
              ) : (
                <ShieldCheck size={15} color={c.emerald600} />
              )}
              <Text style={{ fontSize: fontSize.body, fontWeight: '800', color: c.slate900 }} numberOfLines={1}>
                {closedRoads ?? '—'} Closed
              </Text>
            </View>
            <Text style={{ fontSize: fontSize.caption, color: c.slate500 }} numberOfLines={2}>
              {closedRoads === null ? 'Data unavailable' : closedRoads === 0 ? 'All Roads Open' : 'Roads to avoid'}
            </Text>
          </View>
        </View>

        {/* Route planning */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Plan a safe route"
          onPress={() => router.push('/map')}
          activeOpacity={0.9}
          style={{
            backgroundColor: c.slate900,
            borderRadius: 16,
            padding: space[16],
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[12],
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: c.blue600,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RouteIcon size={22} color={c.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.subtitle, fontWeight: '800', color: c.white }}>Plan a Safe Route</Text>
            <Text style={{ fontSize: fontSize.body, color: c.slate300, marginTop: space[2] }} numberOfLines={1}>
              Find safer routes &amp; avoid flooded roads
            </Text>
          </View>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: c.slate700,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowRight size={17} color={c.white} />
          </View>
        </TouchableOpacity>

        {/* Saved destinations for one-tap routing (opened via Home or Profile) */}
        <QuickPickList clearanceCm={vehicle?.clearance_cm ?? myVehicle?.clearanceCm ?? 28} />

        {/* Current conditions plus a weather advisory, one card: conditions on top, advisory below a divider */}
        {currentWeather?.available ? (
          <View style={{ ...card, padding: space[16], gap: space[12] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6] }}>
              <MapPin size={14} color={c.slate400} />
              <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: c.slate500 }} numberOfLines={1}>
                {weatherPlace ?? 'Your location'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[16] }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 40, fontWeight: '800', color: c.slate900 }}>
                  {Math.round(currentWeather.temperature_c ?? 0)}°
                </Text>
              </View>
              <View style={{ flex: 1, gap: space[4] }}>
                <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: c.slate900 }}>
                  {currentWeather.description ?? 'Cloudy'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
                  <CloudRain size={13} color={c.slate500} />
                  <Text style={{ fontSize: fontSize.caption, color: c.slate500 }}>
                    Precipitation: {Math.round(currentWeather.precipitation_chance_pct ?? 0)}%
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
                  <Droplets size={13} color={c.slate500} />
                  <Text style={{ fontSize: fontSize.caption, color: c.slate500 }}>
                    Humidity: {Math.round(currentWeather.humidity_pct ?? 0)}%
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
                  <Wind size={13} color={c.slate500} />
                  <Text style={{ fontSize: fontSize.caption, color: c.slate500 }}>
                    Wind: {Math.round(currentWeather.wind_kmh ?? 0)} km/h
                  </Text>
                </View>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: c.slate100 }} />
            <View
              style={
                weatherAdvisoryMessage
                  ? { backgroundColor: c.blue50, borderRadius: 12, padding: space[12], gap: space[10] }
                  : { flexDirection: 'row', alignItems: 'center', gap: space[12] }
              }
            >
              {advisoryBody}
            </View>
          </View>
        ) : (
          <View style={{ ...card, padding: space[16], flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
            {advisoryBody}
          </View>
        )}

        {/* The fleet rescue unit this emergency driver reports as (FSD-FR-048) */}
        {vehicleId !== null && vehicle ? (
          <View style={{ ...card, padding: space[16], flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: c.slate100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Truck size={20} color={c.slate900} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: c.slate900 }}>
                {vehicle.call_sign} · {vehicle.vehicle_type}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], marginTop: space[2] }}>
                <Gauge size={13} color={c.slate500} />
                <Text style={{ fontSize: fontSize.body, color: c.slate500 }}>
                  Clearance {vehicle.clearance_cm ?? '—'} cm
                  {vehicle.speed_kmh !== null ? ` · ${Math.round(vehicle.speed_kmh)} km/h` : ''}
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: fontSize.caption,
                fontWeight: '800',
                color: VEHICLE_STATUS_COLOR[vehicle.status] ?? c.slate600,
                textTransform: 'capitalize',
              }}
            >
              {vehicle.status.replace('_', ' ')}
            </Text>
          </View>
        ) : vehicleId === null ? (
          // Public driver's own vehicle, configured in Profile — drives clearance-aware routing.
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Edit my vehicle in Profile"
            onPress={() => router.push('/(tabs)/profile')}
            style={{ ...card, padding: space[16], flexDirection: 'row', alignItems: 'center', gap: space[12] }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: c.slate100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {React.createElement(MY_VEHICLE_ICON[myVehicle?.type ?? 'sedan'], {
                size: 18,
                color: c.slate900,
              })}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: fontSize.lead, fontWeight: '800', color: c.slate900 }}
              >
                {myVehicle?.name ?? 'My vehicle'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], marginTop: space[2] }}>
                <Gauge size={13} color={c.slate500} />
                <Text style={{ fontSize: fontSize.body, color: c.slate500 }}>
                  Clearance {myVehicle?.clearanceCm ?? 28} cm
                </Text>
              </View>
              {myVehicle?.plate ? (
                <Text
                  numberOfLines={1}
                  style={{ fontSize: fontSize.caption, color: c.slate500, marginTop: space[2] }}
                >
                  {myVehicle.plate}
                </Text>
              ) : null}
            </View>
            <Pencil size={16} color={c.slate400} />
          </TouchableOpacity>
        ) : null}

        <Text style={{ fontSize: fontSize.caption, color: c.slate400, textAlign: 'center' }}>
          {updatedAt
            ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : offline
              ? 'Showing saved data from your last connection'
              : 'Loading…'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
