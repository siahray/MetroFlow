import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  Waves,
  Info,
  Target,
  Lock,
  MapPin,
  CheckCircle2,
  Car,
  User,
  BriefcaseMedical,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  WifiOff,
  History,
} from 'lucide-react-native';
import { ApiError, createSOS } from '../../api';
import { reverseGeocodeName } from '../../geocode';

import { useAuth } from '../../auth';
import { Avatar } from '../../components/Avatar';
import { isOffline, useOnline } from '../../offline';
import { loadActiveGarageVehicle } from '../../myVehicle';
import { useDialog } from '../../components/Dialog';
import { useSOSTracker } from '../../sosTracker';
import { fontSize, space, useTheme } from '../../theme';
type SituationType = 'vehicle' | 'pedestrian' | 'medical';

/** Location staleness limit for SOS submissions (VAL-021). */
const SOS_LOCATION_MAX_AGE_MS = 60_000;

// Unlike a flood report, an SOS is not queued for later: dispatch has to receive
// it now, so an offline attempt gets an honest message instead of a timeout.
const OFFLINE_TITLE = 'No connection';
const OFFLINE_MESSAGE =
  'A rescue request needs a live link to dispatch and cannot be sent later. Move to an area with signal and try again. If this is life-threatening, contact local emergency services.';

export default function SOSScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { confirm, notice } = useDialog();
  const [situation, setSituation] = useState<SituationType>('pedestrian');
  const [sending, setSending] = useState(false);
  const [locating, setLocating] = useState(false);
  // The active SOS, its dispatcher log, and the update modal are tracked
  // app-wide (SOSTrackerProvider, mounted at the root layout) rather than in
  // this screen's own state, so the modal can pop up on a status change no
  // matter which tab the driver is on, not only while this screen is focused.
  const { activeSOS: dispatchedSOS, sosLog, track, refresh, showUpdates, clearActive } = useSOSTracker();
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  /** The current GPS fix reverse-geocoded to a street/establishment, shown in
   * the "Your Location" card instead of raw coordinates. Preview only — the
   * actual SOS still takes a fresh fix at send time (VAL-021). */
  const [addressPreview, setAddressPreview] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const online = useOnline();
  const { c, mode } = useTheme();
  const storm = mode === 'storm';

  useEffect(() => {
    (async () => {
      try {
        // Checked-only: never prompt just to preview the address. The real
        // permission request still happens in handleSOS when the driver
        // actually sends the request.
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) {
          setLocationDenied(true);
          return;
        }
        const current =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!current) return;
        const name = await reverseGeocodeName(current.coords.latitude, current.coords.longitude);
        setAddressPreview(name);
      } catch {
        // Leave the generic placeholder; sending the SOS still works either way.
      }
    })();
  }, []);

  async function handleSOS() {
    if (sending || locating) return;

    if (await isOffline()) {
      await notice({ title: OFFLINE_TITLE, message: OFFLINE_MESSAGE, tone: 'warning' });
      return;
    }

    const situationLabel =
      situation === 'vehicle'
        ? 'Vehicle Stuck in Floodwaters'
        : situation === 'medical'
        ? 'Medical Need / Health Crisis'
        : 'Pedestrian / Stranded Citizen';

    // A mis-tap here dispatches a real rescue team, so confirm before the GPS prompt.
    const confirmed = await confirm({
      title: 'Send priority rescue request?',
      message: `${situationLabel}. The emergency operations centre will receive your exact location.`,
      confirmLabel: 'Send Request',
      tone: 'warning',
    });
    if (!confirmed) return;

    // --- Acquire fresh GPS fix (FSD-FR-073, VAL-021) -------------------------
    setLocating(true);
    let coords: { latitude: number; longitude: number };
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        const openSettings = await confirm({
          title: 'Location required',
          message:
            'A rescue team needs your exact position to reach you. Enable location access for MetroFlow in Settings and try again.',
          confirmLabel: 'Open Settings',
          cancelLabel: 'Not Now',
          tone: 'warning',
        });
        if (openSettings) void Linking.openSettings();
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const ageMs = Date.now() - loc.timestamp;
      if (ageMs > SOS_LOCATION_MAX_AGE_MS) {
        await notice({
          title: 'Location stale',
          message: 'Could not get a fresh GPS fix. Move to open sky and retry.',
          tone: 'warning',
        });
        setLocating(false);
        return;
      }
      coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      await notice({
        title: 'GPS error',
        message: 'Cannot read your location. Check that GPS is enabled and try again.',
        tone: 'danger',
      });
      setLocating(false);
      return;
    }
    setLocating(false);

    // --- Submit SOS ----------------------------------------------------------
    setSending(true);
    try {
      // The plate is what lets a crew pick the right vehicle out of a flooded
      // street; it comes from the garage entry that is active today.
      const activeVehicle = await loadActiveGarageVehicle().catch(() => null);
      const result = await createSOS({
        latitude: coords.latitude,
        longitude: coords.longitude,
        note: `PRIORITY RESCUE REQUEST: ${situationLabel}. Water hazard level: critical.`,
        plate_number: activeVehicle?.plate,
      });

      track(result);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      const needsSignIn = apiError?.status === 401;
      const throttled = apiError?.status === 429;
      // A failure with no status and no link is the connection dropping mid-request.
      // Guarded: a NetInfo failure must not replace the original error.
      const dropped = !apiError && (await isOffline().catch(() => false));

      const title = dropped
        ? OFFLINE_TITLE
        : needsSignIn
        ? 'Sign in required'
        : throttled
        ? 'SOS limit reached'
        : 'Dispatch alert';
      const message = dropped
        ? OFFLINE_MESSAGE
        : needsSignIn
        ? 'Please sign in or continue to submit priority rescue requests.'
        : throttled
        ? `${apiError?.message ?? 'Rate limited.'} If this is life-threatening, contact local emergency services.`
        : 'Priority signal failed. If this is life-threatening, contact local emergency services.';

      await notice({ title, message, tone: throttled || needsSignIn ? 'danger' : 'warning' });
    } finally {
      setSending(false);
    }
  }

  async function handleRefreshStatus() {
    if (!dispatchedSOS || refreshingStatus) return;
    setRefreshingStatus(true);
    try {
      await refresh();
    } finally {
      setRefreshingStatus(false);
    }
  }

  /** The driver dismisses a still-open incident themselves; a resolved one
   * clears itself, but a rejected one stays until the driver returns home. */
  function handleReturnHome() {
    clearActive();
    router.replace('/(tabs)/home');
  }

  function handleInfo() {
    void notice({
      title: 'Priority SOS protocol',
      message:
        'Active Geo-Lock transmits telemetry and sub-meter location directly to the MetroFlow LGU Emergency Operations Center (EOC).',
    });
  }

  const card = {
    backgroundColor: c.white,
    borderRadius: 16,
    shadowColor: c.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: c.slate100,
  } as const;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.white }}>
      <StatusBar barStyle={mode === 'storm' ? 'light-content' : 'dark-content'} />

      {/* Header — identical to Home navbar */}
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
              shadowColor: c.blue400,
              shadowOpacity: storm ? 0.5 : 0,
              shadowRadius: storm ? 8 : 0,
              elevation: storm ? 4 : 0,
            }}
          >
            <Waves size={22} color={c.blue600} />
          </View>
          <View>
            <Text style={{ fontSize: fontSize.caption, fontWeight: '800', color: c.blue600, letterSpacing: 0.8 }}>
              METROFLOW
            </Text>
            <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: c.slate900 }}>
              SOS Rescue
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="About SOS Rescue"
            onPress={handleInfo}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: c.slate100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Info size={18} color={c.slate600} />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.push('/(tabs)/profile')}
          >
            <View
              style={{
                shadowColor: c.blue400,
                shadowOpacity: storm ? 0.5 : 0,
                shadowRadius: storm ? 8 : 0,
                elevation: storm ? 4 : 0,
              }}
            >
              <Avatar name={user?.name || user?.email} size={40} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content — matching Home's c.slate50 surface */}
      <ScrollView
        style={{ flex: 1, backgroundColor: c.slate50 }}
        contentContainerStyle={{ padding: space[20], gap: space[16], flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Priority Line Badge */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'center',
            gap: space[8],
            backgroundColor: storm ? 'rgba(239, 68, 68, 0.16)' : c.red50,
            paddingHorizontal: space[14],
            paddingVertical: space[6],
            borderRadius: 999,
            borderWidth: 1,
            borderColor: storm ? 'rgba(248, 113, 113, 0.4)' : c.red200,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: storm ? '#f87171' : c.red600 }} />
          <Text
            style={{
              fontSize: fontSize.caption,
              fontWeight: '800',
              color: storm ? '#fca5a5' : c.red700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            Priority SOS Dispatch Line
          </Text>
        </View>

        {/* Hero Graphic */}
        <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: space[4], position: 'relative' }}>
          <View style={{ width: 124, height: 124, borderRadius: 62, backgroundColor: storm ? '#0d1f38' : c.blue50, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: storm ? '#132c4f' : c.blue100, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', shadowColor: c.blue400, shadowOpacity: storm ? 0.4 : 0.1, shadowRadius: 6, elevation: 3 }}>
                <Target size={34} color={c.blue600} />
              </View>
            </View>
          </View>

          {/* Overlapping Geo-Lock Badge */}
          <View style={{ position: 'absolute', bottom: -8, backgroundColor: storm ? c.white : c.slate900, paddingHorizontal: space[14], paddingVertical: space[5], borderRadius: 999, borderWidth: 1, borderColor: storm ? c.blue300 : c.slate800, flexDirection: 'row', alignItems: 'center', gap: space[6], shadowColor: c.black, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}>
            <Lock size={12} color={storm ? c.blue300 : c.white} />
            <Text style={{ fontSize: fontSize.micro, fontWeight: '800', color: storm ? c.blue300 : c.white, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Active Geo-Lock
            </Text>
          </View>
        </View>

        {/* Title & Description */}
        <View style={{ alignItems: 'center', marginTop: space[10], marginBottom: space[2], paddingHorizontal: space[8] }}>
          <Text style={{ fontSize: fontSize.jumbo, fontWeight: '800', color: c.slate900, marginBottom: space[6], textAlign: 'center' }}>
            Need Assistance?
          </Text>
          <Text style={{ fontSize: fontSize.lead, color: c.slate500, textAlign: 'center', lineHeight: 20 }}>
            If you are stranded or your vehicle is trapped in rising floodwaters, request immediate deployment. Civic dispatch units are active in your sector.
          </Text>
        </View>

        {/* Info Cards */}
        <View style={{ ...card, padding: space[16], flexDirection: 'row', gap: space[14], alignItems: 'flex-start' }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.slate100, alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={22} color={c.blue600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.caption, fontWeight: '800', color: c.blue600, letterSpacing: 0.6, marginBottom: space[2] }}>
              YOUR LOCATION
            </Text>
            <Text style={{ fontSize: fontSize.subtitle, fontWeight: '700', color: c.slate900 }}>
              {addressPreview ?? "Shared from your phone's GPS"}
            </Text>
            <Text style={{ fontSize: fontSize.body, color: c.slate500, marginTop: space[4] }}>
              {locationDenied
                ? 'Enable location in Settings to preview your address — a fresh GPS fix is taken upon sending.'
                : 'A fresh location fix is taken when you send the request.'}
            </Text>
          </View>
        </View>

        {/* Situation Type */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: space[10] }}>
            <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: c.slate900 }}>Situation Type</Text>
            <Text style={{ fontSize: fontSize.caption, fontWeight: '600', color: c.slate500 }}>Tap to refine</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: space[8] }}>
            {/* Vehicle Stuck */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Situation: Vehicle Stuck"
              onPress={() => setSituation('vehicle')}
              style={{
                flex: 1,
                paddingVertical: space[14],
                paddingHorizontal: space[4],
                borderRadius: 16,
                borderWidth: situation === 'vehicle' ? 1.5 : 1,
                borderColor: situation === 'vehicle' ? (storm ? c.blue300 : c.blue600) : c.slate100,
                backgroundColor: c.white,
                alignItems: 'center',
                justifyContent: 'center',
                gap: space[6],
                shadowColor: situation === 'vehicle' ? c.blue400 : c.black,
                shadowOpacity: situation === 'vehicle' ? 0.35 : 0.04,
                shadowRadius: situation === 'vehicle' ? 6 : 2,
                elevation: situation === 'vehicle' ? 3 : 1,
              }}
            >
              <Car size={20} color={situation === 'vehicle' ? (storm ? c.blue300 : c.blue600) : c.slate500} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: situation === 'vehicle' ? (storm ? c.blue300 : c.blue600) : c.slate700, textAlign: 'center' }}>
                Vehicle Stuck
              </Text>
            </TouchableOpacity>

            {/* Pedestrian */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Situation: Pedestrian"
              onPress={() => setSituation('pedestrian')}
              style={{
                flex: 1,
                paddingVertical: space[14],
                paddingHorizontal: space[4],
                borderRadius: 16,
                borderWidth: situation === 'pedestrian' ? 1.5 : 1,
                borderColor: situation === 'pedestrian' ? (storm ? c.blue300 : c.blue600) : c.slate100,
                backgroundColor: c.white,
                alignItems: 'center',
                justifyContent: 'center',
                gap: space[6],
                shadowColor: situation === 'pedestrian' ? c.blue400 : c.black,
                shadowOpacity: situation === 'pedestrian' ? 0.35 : 0.04,
                shadowRadius: situation === 'pedestrian' ? 6 : 2,
                elevation: situation === 'pedestrian' ? 3 : 1,
              }}
            >
              <User size={20} color={situation === 'pedestrian' ? (storm ? c.blue300 : c.blue600) : c.slate500} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: situation === 'pedestrian' ? (storm ? c.blue300 : c.blue600) : c.slate700, textAlign: 'center' }}>
                Pedestrian
              </Text>
            </TouchableOpacity>

            {/* Medical Need */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Situation: Medical Need"
              onPress={() => setSituation('medical')}
              style={{
                flex: 1,
                paddingVertical: space[14],
                paddingHorizontal: space[4],
                borderRadius: 16,
                borderWidth: situation === 'medical' ? 1.5 : 1,
                borderColor: situation === 'medical' ? (storm ? c.blue300 : c.blue600) : c.slate100,
                backgroundColor: c.white,
                alignItems: 'center',
                justifyContent: 'center',
                gap: space[6],
                shadowColor: situation === 'medical' ? c.blue400 : c.black,
                shadowOpacity: situation === 'medical' ? 0.35 : 0.04,
                shadowRadius: situation === 'medical' ? 6 : 2,
                elevation: situation === 'medical' ? 3 : 1,
              }}
            >
              <BriefcaseMedical size={20} color={situation === 'medical' ? (storm ? c.blue300 : c.blue600) : c.slate500} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: situation === 'medical' ? (storm ? c.blue300 : c.blue600) : c.slate700, textAlign: 'center' }}>
                Medical Need
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons / Dispatch Status (FSD-FR-074) */}
        <View style={{ gap: space[10], marginBottom: space[14] }}>
          {dispatchedSOS ? (
            /* ---- Post-submission status panel ---- */
            <View
              style={{
                backgroundColor: storm ? c.green900 : c.green50,
                borderRadius: 18,
                padding: space[18],
                borderWidth: 1,
                borderColor: storm ? c.green700 : c.green200,
                gap: space[10],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
                <CheckCircle2 size={20} color={storm ? c.green300 : c.green600} />
                <Text style={{ fontSize: fontSize.subtitle, fontWeight: '800', color: storm ? c.green200 : c.green800 }}>
                  Rescue Request Sent
                </Text>
              </View>
              <Text style={{ fontSize: fontSize.label, color: storm ? c.green300 : c.green700 }}>
                SOS #{dispatchedSOS.sos_id} •{' '}
                Status:{' '}
                <Text style={{ fontWeight: '800', textTransform: 'capitalize' }}>
                  {dispatchedSOS.status}
                </Text>
              </Text>
              <Text style={{ fontSize: fontSize.body, color: storm ? c.inkMuted : c.slate500 }}>
                Coords: {dispatchedSOS.latitude.toFixed(5)}, {dispatchedSOS.longitude.toFixed(5)}
              </Text>
              {dispatchedSOS.reporter_phone ? (
                <Text style={{ fontSize: fontSize.body, color: storm ? c.inkMuted : c.slate500 }}>
                  Call-back: {dispatchedSOS.reporter_phone}
                </Text>
              ) : (
                <Text style={{ fontSize: fontSize.body, color: storm ? c.amber400 : c.amber700 }}>
                  No call-back number saved. Add one in Profile so dispatch can reach you.
                </Text>
              )}
              {dispatchedSOS.plate_number ? (
                <Text style={{ fontSize: fontSize.body, color: storm ? c.inkMuted : c.slate500 }}>
                  Vehicle plate: {dispatchedSOS.plate_number}
                </Text>
              ) : null}
              {sosLog.length > 0 ? (
                <Text style={{ fontSize: fontSize.body, color: storm ? c.onInk : c.slate700 }}>
                  Latest update: {sosLog[sosLog.length - 1].text}
                </Text>
              ) : null}

              {/* Refresh status */}
              <TouchableOpacity
                onPress={handleRefreshStatus}
                disabled={refreshingStatus}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space[6],
                  paddingVertical: space[10],
                  backgroundColor: c.white,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: storm ? c.slate200 : c.emerald100,
                }}
              >
                {refreshingStatus ? (
                  <ActivityIndicator size="small" color={storm ? c.green300 : c.green600} />
                ) : (
                  <RefreshCw size={14} color={storm ? c.green300 : c.green600} />
                )}
                <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: storm ? c.green300 : c.green600 }}>
                  Check Status
                </Text>
              </TouchableOpacity>

              {/* Full dispatcher action history */}
              <TouchableOpacity
                onPress={showUpdates}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space[6],
                  paddingVertical: space[10],
                  backgroundColor: c.white,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: storm ? c.slate200 : c.emerald100,
                }}
              >
                <History size={14} color={storm ? c.green300 : c.green600} />
                <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: storm ? c.green300 : c.green600 }}>
                  View Updates
                </Text>
              </TouchableOpacity>

              {/* Return home */}
              <TouchableOpacity
                onPress={handleReturnHome}
                style={{
                  paddingVertical: space[12],
                  backgroundColor: storm ? c.white : c.slate900,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: storm ? c.slate900 : c.white }}>
                  Return to Home
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Offline indicator */}
              {!online && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[8],
                    paddingVertical: space[10],
                    paddingHorizontal: space[12],
                    marginBottom: space[6],
                    borderRadius: 12,
                    backgroundColor: c.amber100,
                  }}
                >
                  <WifiOff size={14} color={c.amber800} />
                  <Text style={{ flex: 1, fontSize: fontSize.body, fontWeight: '700', color: c.amber800 }}>
                    Offline: a rescue request needs a live connection.
                  </Text>
                </View>
              )}

              {/* Primary SOS CTA */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Request Emergency Rescue"
                onPress={handleSOS}
                disabled={sending || locating}
                activeOpacity={0.9}
                style={{
                  backgroundColor: storm ? c.white : c.slate900,
                  paddingVertical: space[16],
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: space[8],
                  borderWidth: 2,
                  borderColor: storm ? '#f87171' : '#dc2626',
                  shadowColor: storm ? '#f87171' : '#dc2626',
                  shadowOpacity: storm ? 0.45 : 0.2,
                  shadowRadius: 10,
                  elevation: 5,
                }}
              >
                {locating ? (
                  <>
                    <ActivityIndicator color={storm ? c.slate900 : c.white} />
                    <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: storm ? c.slate900 : c.white }}>
                      Acquiring Location…
                    </Text>
                  </>
                ) : sending ? (
                  <ActivityIndicator color={storm ? c.slate900 : c.white} />
                ) : (
                  <>
                    <View
                      style={{
                        backgroundColor: c.red600,
                        paddingHorizontal: space[8],
                        paddingVertical: space[2],
                        borderRadius: 6,
                        marginRight: space[2],
                      }}
                    >
                      <Text style={{ fontSize: fontSize.caption, fontWeight: '900', color: c.onInk, letterSpacing: 0.8 }}>
                        SOS
                      </Text>
                    </View>
                    <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: storm ? c.slate900 : c.white }}>
                      Request Rescue
                    </Text>
                    <ArrowRight size={18} color={storm ? c.slate900 : c.white} />
                  </>
                )}
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Cancel and return to Home"
                onPress={() => router.replace('/(tabs)/home')}
                style={{
                  paddingVertical: space[14],
                  backgroundColor: c.white,
                  borderWidth: 1,
                  borderColor: c.slate200,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: c.slate600 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Monitored Response Footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[6], marginTop: space[4] }}>
          <ShieldCheck size={15} color={c.blue600} />
          <Text style={{ fontSize: fontSize.caption, fontWeight: '600', color: c.slate500 }}>
            Metro Emergency Dispatch • 24/7 Monitored Response
          </Text>
        </View>
      </ScrollView>

      {/* The dispatch-update modal itself is rendered app-wide by
          SOSTrackerProvider (root layout), not here -- it pops up on a status
          change no matter which tab the driver is on. "View Updates" above
          just opens it on demand via showUpdates(). */}
    </SafeAreaView>
  );
}
