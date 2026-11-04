import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Waves,
  AlertTriangle,
  ChevronRight,
  Search,
  ShieldCheck,
  WifiOff,
  Megaphone,
  LifeBuoy,
  Navigation,
} from 'lucide-react-native';

import { getMission, listActiveHazards, resolveSOS, type HazardInfo, type SOSRequest } from '../../api';
import { useAuth } from '../../auth';
import { Avatar } from '../../components/Avatar';
import { loadCache, saveCache, useOnline } from '../../offline';
import { colors } from '../../theme';

const LEVEL_LABEL: Record<string, string> = {
  CAUTION: 'Caution',
  LEVEL_2: 'Level 2',
  LEVEL_3: 'Level 3',
  IMPASSABLE: 'Impassable',
};
const LEVEL_RANK: Record<string, number> = { CAUTION: 1, LEVEL_2: 2, LEVEL_3: 3, IMPASSABLE: 4 };

function clock(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [hazards, setHazards] = useState<HazardInfo[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mission, setMission] = useState<SOSRequest | null>(null);
  const [closing, setClosing] = useState(false);
  const online = useOnline();

  const displayName = user?.name || user?.email || 'Guest';
  const vehicleId = user?.vehicle_id ?? null;

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
    void loadMission();
    const timer = setInterval(() => void loadMission(), 10000);
    return () => clearInterval(timer);
  }, [online, load, loadMission]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([load(), loadMission()]);
    setRefreshing(false);
  }

  async function handleArrived() {
    if (!mission) return;
    setClosing(true);
    try {
      await resolveSOS(mission.sos_id);
      setMission(null);
    } catch {
      Alert.alert('Could not close the incident', 'The server did not confirm. Try again.');
    } finally {
      setClosing(false);
    }
  }

  const worst = (hazards ?? []).reduce<HazardInfo | null>(
    (top, h) =>
      !top || (LEVEL_RANK[h.obstruction_level] ?? 0) > (LEVEL_RANK[top.obstruction_level] ?? 0)
        ? h
        : top,
    null,
  );
  const impassable = (hazards ?? []).filter((h) => h.obstruction_level === 'IMPASSABLE').length;

  const card = {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate200,
  } as const;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.white }}>
      <StatusBar barStyle="dark-content" />

      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderColor: colors.slate100,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: colors.blue100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Waves size={18} color={colors.blue600} />
          </View>
          <View>
            <Text style={{ fontSize: 9, fontWeight: '800', color: colors.blue600, letterSpacing: 0.8 }}>
              METROFLOW
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.slate900 }}>Home</Text>
          </View>
        </View>
        <Avatar name={user?.name || user?.email} size={34} />
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.slate50 }}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Who is signed in, and whether the data is live */}
        <View
          style={{
            ...card,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.slate800 }} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={{ fontSize: 11, color: colors.slate500, marginTop: 2 }}>
              {user ? 'Signed in' : 'Guest: sign in to submit reports'}
            </Text>
          </View>
          {offline || !online ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <WifiOff size={13} color={colors.amber800} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.amber800 }}>Offline</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={13} color={colors.green600} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.green700 }}>Live</Text>
            </View>
          )}
        </View>

        {/* Dispatch: the incident this unit was assigned in the portal */}
        {mission && vehicleId !== null && (
          <View
            style={{
              ...card,
              backgroundColor: colors.red50,
              borderColor: colors.red500,
              padding: 14,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LifeBuoy size={18} color={colors.red700} />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.red700 }}>
                Dispatched: incident #{mission.sos_id}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.slate700 }}>
              Scene at {mission.latitude.toFixed(4)}° N, {mission.longitude.toFixed(4)}° E
            </Text>
            {mission.note ? (
              <Text style={{ fontSize: 11, color: colors.slate700 }} numberOfLines={2}>
                {mission.note}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Navigate to the assigned incident"
                onPress={() =>
                  router.push({
                    pathname: '/route',
                    params: { destination: `${mission.latitude},${mission.longitude}` },
                  })
                }
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: colors.slate900,
                  borderRadius: 10,
                  paddingVertical: 10,
                }}
              >
                <Navigation size={14} color={colors.white} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.white }}>
                  Navigate
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Mark the incident as reached"
                disabled={closing}
                onPress={handleArrived}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.red500,
                  borderRadius: 10,
                  paddingVertical: 10,
                  opacity: closing ? 0.6 : 1,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.red700 }}>
                  {closing ? 'Closing…' : 'Mark arrived'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Hazard status, from the verified hazard feed */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open the live map"
          onPress={() => router.push('/(tabs)/map')}
          activeOpacity={0.88}
          style={{
            ...card,
            backgroundColor: worst ? colors.red50 : colors.white,
            borderColor: worst ? colors.red500 : colors.slate200,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: worst ? colors.red700 : colors.slate100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={18} color={worst ? colors.white : colors.slate500} />
          </View>
          <View style={{ flex: 1 }}>
            {hazards === null ? (
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.slate700 }}>
                Hazard feed unavailable
              </Text>
            ) : worst ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.red700 }}>
                  {hazards.length} active hazard{hazards.length === 1 ? '' : 's'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.slate700, marginTop: 2 }} numberOfLines={1}>
                  Worst: {worst.name} ({LEVEL_LABEL[worst.obstruction_level] ?? worst.obstruction_level})
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.slate700 }}>
                No active hazards reported
              </Text>
            )}
          </View>
          <ChevronRight size={16} color={colors.slate400} />
        </TouchableOpacity>

        {/* Route planning */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Plan a safe route"
          onPress={() => router.push('/route')}
          activeOpacity={0.9}
          style={{
            backgroundColor: colors.slate900,
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Search size={20} color={colors.white} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.white }}>Plan a safe route</Text>
            <Text style={{ fontSize: 11, color: colors.slate300, marginTop: 2 }}>
              Flood-aware routing for your vehicle clearance
            </Text>
          </View>
          <ChevronRight size={16} color={colors.slate300} />
        </TouchableOpacity>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[
            { label: 'Report a hazard', icon: Megaphone, to: '/(tabs)/report' as const },
            { label: 'Request rescue', icon: LifeBuoy, to: '/(tabs)/sos' as const },
          ].map(({ label, icon: Icon, to }) => (
            <TouchableOpacity
              key={label}
              accessibilityRole="button"
              onPress={() => router.push(to)}
              style={{ ...card, flex: 1, padding: 14, gap: 8 }}
            >
              <Icon size={20} color={colors.slate900} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.slate900 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Counts come from the same feed; nothing here is simulated */}
        <View style={{ ...card, padding: 14 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.slate900 }}>Network status</Text>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.slate500 }}>Active hazards</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.slate900, marginTop: 2 }}>
                {hazards ? hazards.length : '—'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.slate500 }}>Impassable</Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '800',
                  color: impassable > 0 ? colors.red600 : colors.slate900,
                  marginTop: 2,
                }}
              >
                {hazards ? impassable : '—'}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 10, color: colors.slate400, marginTop: 10 }}>
            {updatedAt
              ? `Updated ${clock(updatedAt)}`
              : offline
                ? 'Showing saved data from your last connection'
                : 'Loading…'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
