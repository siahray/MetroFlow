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
} from 'lucide-react-native';
import { ApiError, createSOS, getSOS, type SOSRequest } from '../../api';

import { useAuth } from '../../auth';
import { Avatar } from '../../components/Avatar';
import { BackButton } from '../../components/BackButton';
import { isOffline, useOnline } from '../../offline';
import { loadActiveGarageVehicle } from '../../myVehicle';
import { useDialog } from '../../components/Dialog';
import { fontSize, space, useTheme } from '../../theme';
type SituationType = 'vehicle' | 'pedestrian' | 'medical';

/** Location staleness limit for SOS submissions (VAL-021). */
const SOS_LOCATION_MAX_AGE_MS = 60_000;

/** Once an incident reaches one of these states, polling its status is pointless. */
const FINAL_SOS_STATUSES = new Set(['RESOLVED', 'REJECTED']);

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
  /** SOS record returned on success — drives the status panel (FSD-FR-074). */
  const [dispatchedSOS, setDispatchedSOS] = useState<SOSRequest | null>(null);
  const [sosStatus, setSosStatus] = useState<string | null>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const online = useOnline();
  const { c, mode } = useTheme();

  // The SOS change feed is dispatcher-only, so a driver polls its own submission
  // until the dispatcher's decision arrives (FSD-FR-074).
  const trackedSOSId = dispatchedSOS?.sos_id ?? null;
  const trackedSOSFinal = dispatchedSOS
    ? FINAL_SOS_STATUSES.has(dispatchedSOS.status.toUpperCase())
    : true;

  useEffect(() => {
    if (trackedSOSId === null || trackedSOSFinal) return;
    const timer = setInterval(() => {
      getSOS(trackedSOSId)
        .then((updated) => {
          setSosStatus(updated.status);
          setDispatchedSOS(updated);
        })
        .catch(() => {
          // Keep the last known status; the next poll or manual refresh retries.
        });
    }, 5000);
    return () => clearInterval(timer);
  }, [trackedSOSId, trackedSOSFinal]);

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

      setDispatchedSOS(result);
      setSosStatus(result.status);
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
      const updated = await getSOS(dispatchedSOS.sos_id);
      setSosStatus(updated.status);
      setDispatchedSOS(updated);
    } catch {
      // Status refresh failure is non-critical; keep showing last known status.
    } finally {
      setRefreshingStatus(false);
    }
  }

  function handleInfo() {
    void notice({
      title: 'Priority SOS protocol',
      message:
        'Active Geo-Lock transmits telemetry and sub-meter location directly to the MetroFlow LGU Emergency Operations Center (EOC).',
    });
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.slate50 }}>
      <StatusBar barStyle={mode === 'storm' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={{ paddingHorizontal: space[20], paddingTop: space[10], paddingBottom: space[10], backgroundColor: c.slate50 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[12] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.blue100, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center' }}>
              <Waves size={18} color={c.blue600} />
            </View>
            <View>
              <Text style={{ fontSize: fontSize.tiny, fontWeight: '800', color: c.blue600, textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 12 }}>
                METROFLOW
              </Text>
              <Text style={{ fontSize: fontSize.heading, fontWeight: '800', color: c.slate900, lineHeight: 20 }}>
                SOS Rescue Dispatch
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
            <Avatar name={user?.name || user?.email} size={32} />
          </View>
        </View>

        {/* Subheader */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[2] }}>
          <BackButton />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6], backgroundColor: c.red50, paddingHorizontal: space[14], paddingVertical: space[6], borderRadius: 999, borderWidth: 1, borderColor: c.red100 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.red500 }} />
            <Text style={{ fontSize: fontSize.caption, fontWeight: '800', color: c.red600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              PRIORITY SOS LINE
            </Text>
          </View>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="About this screen"
            onPress={handleInfo}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(226,232,240,0.6)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Info size={18} color={c.slate700} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space[20], paddingTop: space[4], paddingBottom: space[28] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Graphic */}
        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: space[6], marginBottom: space[12], position: 'relative' }}>
          <View style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: c.blue50, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: c.blue100, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', shadowColor: c.black, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 }}>
                <Target size={38} color={c.blue600} />
              </View>
            </View>
          </View>

          {/* Overlapping Geo-Lock Badge */}
          <View style={{ position: 'absolute', bottom: -10, backgroundColor: c.slate900, paddingHorizontal: space[14], paddingVertical: space[5], borderRadius: 999, borderWidth: 2, borderColor: c.white, flexDirection: 'row', alignItems: 'center', gap: space[6], shadowColor: c.black, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 }}>
            <Lock size={11} color={c.white} />
            <Text style={{ fontSize: fontSize.micro, fontWeight: '800', color: c.white, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Active Geo-Lock
            </Text>
          </View>
        </View>

        {/* Title & Description */}
        <View style={{ alignItems: 'center', marginTop: space[18], marginBottom: space[18], paddingHorizontal: space[4] }}>
          <Text style={{ fontSize: fontSize.jumbo, fontWeight: '800', color: c.slate900, marginBottom: space[6] }}>
            Need Assistance?
          </Text>
          <Text style={{ fontSize: fontSize.label, color: c.slate500, textAlign: 'center', lineHeight: 20, paddingHorizontal: space[8] }}>
            If you are stranded or your vehicle is trapped in rising floodwaters, request immediate deployment. Civic dispatch units are active in your sector.
          </Text>
        </View>

        {/* Info Cards */}
        <View style={{ gap: space[12], marginBottom: space[18] }}>
          {/* Identified Location */}
          <View style={{ backgroundColor: c.white, borderRadius: 18, padding: space[14], flexDirection: 'row', gap: space[14], borderWidth: 1, borderColor: c.slate100, shadowColor: c.black, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.slate100, alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={20} color={c.slate900} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[2] }}>
                <Text style={{ fontSize: fontSize.micro, fontWeight: '800', color: c.blue600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  YOUR LOCATION
                </Text>
              </View>
              <Text style={{ fontSize: fontSize.subtitle, fontWeight: '700', color: c.slate900 }}>
                {"Shared from your phone's GPS"}
              </Text>
              <Text style={{ fontSize: fontSize.body, color: c.slate500, marginTop: space[2] }}>
                A fresh location fix is taken when you send the request.
              </Text>
            </View>
          </View>

        </View>

        {/* Situation Type */}
        <View style={{ marginBottom: space[18] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: space[10] }}>
            <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900 }}>Situation Type</Text>
            <Text style={{ fontSize: fontSize.caption, fontWeight: '500', color: c.slate500 }}>Tap to refine</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: space[8] }}>
            {/* Vehicle Stuck */}
            <TouchableOpacity
              onPress={() => setSituation('vehicle')}
              style={{ flex: 1, paddingVertical: space[14], paddingHorizontal: space[4], borderRadius: 18, borderWidth: situation === 'vehicle' ? 1.5 : 1, borderColor: situation === 'vehicle' ? c.slate900 : c.slate200, backgroundColor: situation === 'vehicle' ? c.slate900 : c.white, alignItems: 'center', justifyContent: 'center', gap: space[6], shadowColor: c.black, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 }}
            >
              <Car size={20} color={situation === 'vehicle' ? c.white : c.slate900} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: situation === 'vehicle' ? c.white : c.slate900, textAlign: 'center' }}>
                Vehicle Stuck
              </Text>
            </TouchableOpacity>

            {/* Pedestrian */}
            <TouchableOpacity
              onPress={() => setSituation('pedestrian')}
              style={{ flex: 1, paddingVertical: space[14], paddingHorizontal: space[4], borderRadius: 18, borderWidth: situation === 'pedestrian' ? 1.5 : 1, borderColor: situation === 'pedestrian' ? c.slate900 : c.slate200, backgroundColor: situation === 'pedestrian' ? c.slate900 : c.white, alignItems: 'center', justifyContent: 'center', gap: space[6], shadowColor: c.black, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 }}
            >
              <User size={20} color={situation === 'pedestrian' ? c.white : c.slate900} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: situation === 'pedestrian' ? c.white : c.slate900, textAlign: 'center' }}>
                Pedestrian
              </Text>
            </TouchableOpacity>

            {/* Medical Need */}
            <TouchableOpacity
              onPress={() => setSituation('medical')}
              style={{ flex: 1, paddingVertical: space[14], paddingHorizontal: space[4], borderRadius: 18, borderWidth: situation === 'medical' ? 1.5 : 1, borderColor: situation === 'medical' ? c.slate900 : c.slate200, backgroundColor: situation === 'medical' ? c.slate900 : c.white, alignItems: 'center', justifyContent: 'center', gap: space[6], shadowColor: c.black, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 }}
            >
              <BriefcaseMedical size={20} color={situation === 'medical' ? c.white : c.slate900} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: situation === 'medical' ? c.white : c.slate900, textAlign: 'center' }}>
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
                backgroundColor: c.green50,
                borderRadius: 18,
                padding: space[18],
                borderWidth: 1,
                borderColor: c.green200,
                gap: space[10],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
                <CheckCircle2 size={20} color={c.green600} />
                <Text style={{ fontSize: fontSize.subtitle, fontWeight: '800', color: c.green800 }}>
                  Rescue Request Sent
                </Text>
              </View>
              <Text style={{ fontSize: fontSize.label, color: c.green700 }}>
                SOS #{dispatchedSOS.sos_id} •{' '}
                Status:{' '}
                <Text style={{ fontWeight: '800', textTransform: 'capitalize' }}>
                  {sosStatus ?? dispatchedSOS.status}
                </Text>
              </Text>
              <Text style={{ fontSize: fontSize.body, color: c.slate500 }}>
                Coords: {dispatchedSOS.latitude.toFixed(5)}, {dispatchedSOS.longitude.toFixed(5)}
              </Text>
              {dispatchedSOS.reporter_phone ? (
                <Text style={{ fontSize: fontSize.body, color: c.slate500 }}>
                  Call-back: {dispatchedSOS.reporter_phone}
                </Text>
              ) : (
                <Text style={{ fontSize: fontSize.body, color: c.amber700 }}>
                  No call-back number saved. Add one in Profile so dispatch can reach you.
                </Text>
              )}
              {dispatchedSOS.plate_number ? (
                <Text style={{ fontSize: fontSize.body, color: c.slate500 }}>
                  Vehicle plate: {dispatchedSOS.plate_number}
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
                  borderColor: c.emerald100,
                }}
              >
                {refreshingStatus ? (
                  <ActivityIndicator size="small" color={c.green600} />
                ) : (
                  <RefreshCw size={14} color={c.green600} />
                )}
                <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: c.green600 }}>
                  Check Status
                </Text>
              </TouchableOpacity>

              {/* Return home */}
              <TouchableOpacity
                onPress={() => router.replace('/(tabs)/home')}
                style={{
                  paddingVertical: space[12],
                  backgroundColor: c.slate900,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: c.white }}>
                  Return to Home
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Offline indicator: the CTA below cannot reach dispatch. */}
              {!online && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[8],
                    paddingVertical: space[10],
                    paddingHorizontal: space[12],
                    marginBottom: space[10],
                    borderRadius: 12,
                    backgroundColor: c.amber100,
                  }}
                >
                  <WifiOff size={14} color={c.amber800} />
                  <Text
                    style={{ flex: 1, fontSize: fontSize.body, fontWeight: '700', color: c.amber800 }}
                  >
                    Offline: a rescue request needs a live connection.
                  </Text>
                </View>
              )}

              {/* Primary SOS CTA */}
              <TouchableOpacity
                onPress={handleSOS}
                disabled={sending || locating}
                style={{ backgroundColor: c.slate900, paddingVertical: space[16], borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space[8], shadowColor: c.black, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 }}
              >
                {locating ? (
                  <>
                    <ActivityIndicator color={c.white} />
                    <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.white }}>
                      Getting Location…
                    </Text>
                  </>
                ) : sending ? (
                  <ActivityIndicator color={c.white} />
                ) : (
                  <>
                    <Text style={{ fontSize: fontSize.subtitle, fontWeight: '900', color: c.white, letterSpacing: 0.8 }}>
                      SOS
                    </Text>
                    <Text style={{ fontSize: fontSize.subtitle, fontWeight: '700', color: c.white }}>
                      Request Rescue
                    </Text>
                    <ArrowRight size={16} color={c.white} />
                  </>
                )}
              </TouchableOpacity>

              {/* Secondary Buttons Row */}
              <View style={{ flexDirection: 'row', gap: space[10] }}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{ flex: 1, paddingVertical: space[14], backgroundColor: c.white, borderWidth: 1, borderColor: c.slate200, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: c.slate600 }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Monitored Response Footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[6], marginTop: space[4] }}>
          <ShieldCheck size={14} color={c.sky600} />
          <Text style={{ fontSize: fontSize.micro, fontWeight: '600', color: c.slate500 }}>
            Metro Emergency Dispatch • 24/7 Monitored Response
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
