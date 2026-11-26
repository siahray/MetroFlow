import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import {
  Waves,
  Droplet,
  Camera,
  ImagePlus,
  MapPin,
  Check,
  Home,
  Car,
  Truck,
  Ban,
  Send,
  X,
  RefreshCw,
  History,
} from 'lucide-react-native';
import { useAuth } from '../../auth';
import { Avatar } from '../../components/Avatar';
import { useDialog } from '../../components/Dialog';
import { enqueueReport, isOffline, newClientId } from '../../offline';
import { reverseGeocodeBarangay, reverseGeocodeName } from '../../geocode';
import {
  ApiError,
  submitReport,
  type ReportCreated,
  type ReportDepth,
  type ReportPhoto,
} from '../../api';

import { fontSize, space, useTheme } from '../../theme';
type Depth = 'ankle' | 'knee' | 'waist';
type Passability = 'all' | 'high' | 'none';
type LocationState = 'locating' | 'ready' | 'denied' | 'error';

const DEPTH_OPTIONS: { id: Depth; label: string; detail: string; cm: number; api: ReportDepth }[] = [
  { id: 'ankle', label: 'Ankle Deep', detail: 'Around 0.5 ft (15 cm)', cm: 15, api: 'ANKLE' },
  { id: 'knee',  label: 'Knee Deep',  detail: 'Around 1.5 ft (45 cm)', cm: 45, api: 'KNEE' },
  { id: 'waist', label: 'Waist Deep / Submerged', detail: 'Exceeds 3.0 ft (>90 cm) • Severe', cm: 90, api: 'IMPASSABLE' },
];

const QUICK_TAGS = ['+ Fast Current', '+ Open Manhole', '+ Stalled Vehicles'];

const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

const PASSABILITY_LABELS: Record<Passability, string> = {
  all: 'Passable for all vehicles',
  high: 'Passable for high-clearance vehicles only',
  none: 'Not passable',
};

const CAPTURE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  // 0.6 still produced camera photos over the API's 4 MB ceiling on high-resolution phones.
  quality: 0.4,
  exif: true,
};

function parseExifDate(raw?: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  const iso = `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(5)}° ${value >= 0 ? positive : negative}`;
}

function formatClock(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
}

function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Could not reach the dispatch server. You may be offline; your report draft is saved. Tap Retry to resubmit.';
  }
  switch (error.status) {
    case 401:
      return 'Sign in to submit a field report.';
    case 413:
      return 'That photo is larger than 4 MB. Retake it at a lower resolution or pick a smaller image.';
    case 415:
      return 'That file is not a JPEG, PNG or WebP image. Choose a photo instead.';
    case 429:
      return `${error.message} Reports are rate-limited to prevent false floods.`;
    default:
      return error.message || 'Submission failed. Please try again.';
  }
}

export default function ReportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { confirm } = useDialog();

  const [depth, setDepth] = useState<Depth>('knee');
  const [passability, setPassability] = useState<Passability>('high');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<(ReportPhoto & { capturedAt: string }) | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [position, setPosition] = useState<Location.LocationObjectCoords | null>(null);
  const [fixAt, setFixAt] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const placeNameGeneration = useRef(0);
  const [barangay, setBarangay] = useState('');
  const [barangayEdited, setBarangayEdited] = useState(false);
  const barangayGeneration = useRef(0);
  const [locationState, setLocationState] = useState<LocationState>('locating');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgTone, setMsgTone] = useState<'error' | 'info'>('info');
  const [result, setResult] = useState<ReportCreated | null>(null);
  const { c, mode } = useTheme();
  const storm = mode === 'storm';

  const readPosition = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationState('denied');
        setLocationError(
          'MetroFlow needs your location to pin exactly where you saw the flood. Enable location access in Settings.',
        );
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setPosition(current.coords);
      setFixAt(new Date().toISOString());
      setLocationState('ready');
      setLocationError(null);
    } catch {
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown?.coords) {
          setPosition(lastKnown.coords);
          setFixAt(new Date(lastKnown.timestamp).toISOString());
          setLocationState('ready');
          setLocationError(null);
          return;
        }
      } catch {
        // High accuracy and last-known both failed
      }
      setLocationState('error');
      setLocationError('Could not read your GPS position. Check that location is on and retry.');
    }
  }, []);

  function handleRetryLocation() {
    setLocationState('locating');
    setLocationError(null);
    void readPosition();
  }

  useEffect(() => {
    (async () => {
      await readPosition();
    })();
  }, [readPosition]);

  // Resolve the GPS fix to a human address, same reverse-geocode as the
  // driver app's drop-a-pin: the pin label leads with the real place, not
  // raw coordinates, which stay as a smaller supporting detail below it.
  // Clearing the stale name on a new fix is React's "adjust state during
  // render" pattern (see `RouteMap.tsx`'s `prevActiveForFollow`), not a
  // synchronous setState in the effect body below.
  const [prevPositionForPlaceName, setPrevPositionForPlaceName] = useState(position);
  if (position !== prevPositionForPlaceName) {
    setPrevPositionForPlaceName(position);
    setPlaceName(null);
    setBarangay('');
    setBarangayEdited(false);
  }
  useEffect(() => {
    if (!position) return;
    const generation = ++placeNameGeneration.current;
    const barangayGen = ++barangayGeneration.current;
    void reverseGeocodeName(position.latitude, position.longitude).then((name) => {
      if (placeNameGeneration.current === generation) setPlaceName(name);
    });
    void reverseGeocodeBarangay(position.latitude, position.longitude).then((name) => {
      if (barangayGeneration.current === barangayGen) {
        setBarangay((current) => (current.trim() ? current : (name ?? '')));
      }
    });
  }, [position]);

  function handleToggleTag(tag: string) {
    const cleanTag = tag.replace(/^\+\s*/, '');
    if (notes.includes(cleanTag)) {
      setNotes((prev) =>
        prev
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== cleanTag)
          .join(', ')
      );
    } else {
      setNotes((prev) => (prev ? `${prev}, ${cleanTag}` : cleanTag));
    }
  }

  async function handleCapture(fromCamera: boolean) {
    if (photoBusy) return;
    setPhotoBusy(true);
    setMsg('');
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMsgTone('error');
        setMsg(
          fromCamera
            ? 'Camera permission is required to photograph the waterline.'
            : 'Photo library permission is required to attach an existing image.'
        );
        return;
      }

      // The timestamp is taken from the device clock at the moment of capture,
      // which is what the moderation desk compares against the flood window.
      const capturedAt = new Date().toISOString();
      const picked = fromCamera
        ? await ImagePicker.launchCameraAsync(CAPTURE_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(CAPTURE_OPTIONS);
      if (picked.canceled || picked.assets.length === 0) return;

      const asset = picked.assets[0];
      // The picker's fileSize is often missing for camera captures, so measure the file.
      let size = asset.fileSize ?? 0;
      try {
        size = new File(asset.uri).size ?? size;
      } catch {
        // Keep the picker's figure.
      }
      if (size > PHOTO_MAX_BYTES) {
        setMsgTone('error');
        setMsg('That photo is larger than 4 MB. Retake it at a lower resolution or pick a smaller image.');
        return;
      }

      const exifTime =
        parseExifDate(asset.exif?.DateTimeOriginal) ??
        parseExifDate(asset.exif?.DateTimeDigitized) ??
        parseExifDate(asset.exif?.DateTime);

      setPhoto({
        uri: asset.uri,
        name: asset.fileName ?? `report-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
        capturedAt: exifTime ?? capturedAt,
      });
    } catch {
      setMsgTone('error');
      setMsg('Could not open the camera or photo library. Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    if (!position) {
      setMsgTone('error');
      setMsg(
        locationState === 'denied'
          ? 'Allow location access before submitting: the report needs a GPS pin.'
          : 'Waiting for a GPS fix. Move into the open and retry.'
      );
      return;
    }
    if (!photo) {
      setMsgTone('error');
      setMsg('A photo is required to submit a flood report. Please take or attach a photo.');
      return;
    }

    const selected = DEPTH_OPTIONS.find((d) => d.id === depth)!;

    const confirmed = await confirm({
      title: 'Submit report?',
      message: `${selected.label} at your current pin with a photo. The moderation desk reviews it before it shows on the map.`,
      confirmLabel: 'Submit Report',
    });
    if (!confirmed) return;

    setSubmitting(true);
    setMsg('');
    setResult(null);

    // One id per submission, so a retry after a lost response is stored once.
    const payload = {
      clientId: newClientId(),
      depthLevel: selected.api,
      latitude: position.latitude,
      longitude: position.longitude,
      barangay: barangay.trim() || null,
      capturedAt: photo.capturedAt,
      photo: { uri: photo.uri, name: photo.name, type: photo.type },
    };
    let narrative = '';
    try {
      // Passability is a driver observation too, so it travels in the narrative
      // the moderator reads rather than inventing a field the API does not have.
      narrative = [`Passability: ${PASSABILITY_LABELS[passability]}.`, notes.trim()]
        .filter(Boolean)
        .join(' ');

      // Known offline: queue at once rather than waiting for the request to fail.
      if (await isOffline()) throw new TypeError('offline');
      const created = await submitReport({ ...payload, narrative });

      setResult(created);
      setMsgTone('info');
      setMsg('Report received. The moderation desk now sees it in the queue.');
      setTimeout(() => router.replace('/(tabs)/home'), 2500);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        console.warn('report upload failed', error);
        // No connection: keep the report and send it when one returns (FSD-FR-068).
        await enqueueReport({ ...payload, narrative });
        setMsgTone('info');
        setMsg(
          (await isOffline())
            ? 'You are offline. The report is saved and will be sent when the connection returns.'
            : `Could not reach the server (${error instanceof Error ? error.message : String(error)}). The report is saved and will be retried automatically.`
        );
        setTimeout(() => router.replace('/(tabs)/home'), 2500);
      } else {
        setMsgTone('error');
        setMsg(describeError(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && !result && locationState === 'ready' && position !== null;

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
              Report Hazard
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="View submitted reports history"
            onPress={() => router.push('/report-history')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: c.slate100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <History size={18} color={c.slate600} />
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

      {/* Scrollable Content — matching Home & SOS c.slate50 surface */}
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.slate50 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1, backgroundColor: c.slate50 }}
          contentContainerStyle={{ padding: space[20], gap: space[16], paddingBottom: space[32], flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Moderation Queue Badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'center',
              gap: space[8],
              backgroundColor: storm ? 'rgba(59, 130, 246, 0.16)' : c.blue50,
              paddingHorizontal: space[14],
              paddingVertical: space[6],
              borderRadius: 999,
              borderWidth: 1,
              borderColor: storm ? 'rgba(96, 165, 250, 0.4)' : c.blue200,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: storm ? '#60a5fa' : c.blue600 }} />
            <Text
              style={{
                fontSize: fontSize.caption,
                fontWeight: '800',
                color: storm ? '#93c5fd' : c.blue700,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Citizen Moderation Queue
            </Text>
          </View>

          {/* Banner */}
          <View style={{ ...card, padding: space[16], flexDirection: 'row', gap: space[14], alignItems: 'flex-start' }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.slate100, alignItems: 'center', justifyContent: 'center' }}>
              <Droplet size={22} color={c.blue600} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.subtitle, fontWeight: '700', color: c.slate900, marginBottom: space[2] }}>
                Community Flood Watch
              </Text>
              <Text style={{ fontSize: fontSize.body, color: c.slate500, lineHeight: 18 }}>
                Your report joins the moderation queue. Once verified, it becomes a hazard that reroutes fellow drivers.
              </Text>
            </View>
          </View>

          {!user ? (
            <View style={{ flexDirection: 'row', gap: space[10], backgroundColor: c.orange50, borderWidth: 1, borderColor: c.orange200, borderRadius: 14, padding: space[12] }}>
              <Text style={{ fontSize: fontSize.body, color: c.orange800, flex: 1, lineHeight: 18 }}>
                You are browsing as a guest. Sign in from the profile tab to submit reports.
              </Text>
            </View>
          ) : null}

          {/* Section 1: Photo */}
          <View style={{ gap: space[10] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: c.slate900 }}>
                1. Take a Photo <Text style={{ color: c.red500 }}>*</Text>
              </Text>
              <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: c.blue600 }}>Required for verification</Text>
            </View>

            {photo ? (
              <View style={{ ...card, overflow: 'hidden' }}>
                <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 170 }} resizeMode="cover" />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[12] }}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: fontSize.body, fontWeight: '700', color: c.slate800 }}>
                      {photo.name}
                    </Text>
                    <Text style={{ fontSize: fontSize.caption, color: c.slate500, marginTop: space[2] }}>
                      Captured {formatClock(photo.capturedAt)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setPhoto(null)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], paddingHorizontal: space[12], paddingVertical: space[7], backgroundColor: storm ? 'rgba(239, 68, 68, 0.16)' : c.red50, borderRadius: 999 }}
                  >
                    <X size={13} color={storm ? '#fca5a5' : c.red700} />
                    <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: storm ? '#fca5a5' : c.red700 }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ borderWidth: 1.5, borderColor: c.slate200, borderStyle: 'dashed', borderRadius: 16, paddingVertical: space[22], paddingHorizontal: space[16], alignItems: 'center', justifyContent: 'center', backgroundColor: c.white }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: space[6] }}>
                  {photoBusy ? <ActivityIndicator color={c.blue600} /> : <Camera size={22} color={c.blue600} />}
                </View>
                <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: c.slate800 }}>
                  Snap the waterline against a curb or vehicle
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: c.slate400, marginTop: space[2] }}>
                  JPEG, PNG or WebP up to 4 MB
                </Text>
                <View style={{ flexDirection: 'row', gap: space[8], marginTop: space[12] }}>
                  <TouchableOpacity
                    onPress={() => void handleCapture(true)}
                    disabled={photoBusy}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space[6], paddingHorizontal: space[14], paddingVertical: space[8], backgroundColor: c.blue50, borderRadius: 999, borderWidth: 1, borderColor: c.blue100, opacity: photoBusy ? 0.6 : 1 }}
                  >
                    <Camera size={14} color={c.blue700} />
                    <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: c.blue700 }}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void handleCapture(false)}
                    disabled={photoBusy}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space[6], paddingHorizontal: space[14], paddingVertical: space[8], backgroundColor: c.white, borderRadius: 999, borderWidth: 1, borderColor: c.slate200, opacity: photoBusy ? 0.6 : 1 }}
                  >
                    <ImagePlus size={14} color={c.slate600} />
                    <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: c.slate600 }}>Library</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Section 2: Location & Depth */}
          <View style={{ gap: space[12] }}>
            <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: c.slate900 }}>
              2. Location & Depth <Text style={{ color: c.red500 }}>*</Text>
            </Text>

            {/* GPS card */}
            <View style={{ ...card, padding: space[16], flexDirection: 'row', alignItems: 'center', gap: space[14] }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.slate100, alignItems: 'center', justifyContent: 'center' }}>
                {locationState === 'locating' ? (
                  <ActivityIndicator color={c.blue600} />
                ) : (
                  <MapPin size={22} color={locationState === 'ready' ? c.emerald600 : c.blue600} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.caption, fontWeight: '800', color: c.blue600, letterSpacing: 0.6, marginBottom: space[2] }}>
                  {locationState === 'ready' ? 'GPS PIN' : 'DATE & GPS'}
                </Text>
                {locationState === 'ready' && position ? (
                  <>
                    <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900, marginTop: space[1] }}>
                      {placeName ?? (
                        <>
                          {formatCoordinate(position.latitude, 'N', 'S')}, {formatCoordinate(position.longitude, 'E', 'W')}
                        </>
                      )}
                    </Text>
                    {placeName ? (
                      <Text style={{ fontSize: fontSize.micro, color: c.slate400, marginTop: space[1] }}>
                        {formatCoordinate(position.latitude, 'N', 'S')}, {formatCoordinate(position.longitude, 'E', 'W')}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: fontSize.caption, color: c.slate500, marginTop: space[1] }}>
                      {position.accuracy != null ? `±${Math.round(position.accuracy)} m • ` : ''}
                      {fixAt ? `Pin taken ${formatClock(fixAt)}` : 'Pin taken'}
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: fontSize.body, color: locationState === 'denied' ? c.red700 : c.slate500, marginTop: space[2], lineHeight: 17 }}>
                    {locationState === 'locating'
                      ? 'Reading your position…'
                      : locationError ?? 'Position unavailable.'}
                  </Text>
                )}
              </View>
              {locationState === 'denied' ? (
                <TouchableOpacity
                  onPress={() => void Linking.openSettings()}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], paddingHorizontal: space[12], paddingVertical: space[6], backgroundColor: c.blue50, borderRadius: 10 }}
                >
                  <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: c.blue700 }}>Open Settings</Text>
                </TouchableOpacity>
              ) : locationState !== 'ready' && locationState !== 'locating' ? (
                <TouchableOpacity
                  onPress={handleRetryLocation}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], paddingHorizontal: space[12], paddingVertical: space[6], backgroundColor: c.blue50, borderRadius: 10 }}
                >
                  <RefreshCw size={12} color={c.blue700} />
                  <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: c.blue700 }}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={{ gap: space[6] }}>
              <Text style={{ fontSize: fontSize.body, fontWeight: '600', color: c.slate500 }}>
                Barangay
              </Text>
              <TextInput
                value={barangay}
                onChangeText={(value) => {
                  setBarangay(value);
                  setBarangayEdited(true);
                }}
                placeholder={position ? 'Detecting barangay…' : 'Auto-filled from GPS'}
                placeholderTextColor={c.slate400}
                style={{
                  ...card,
                  paddingHorizontal: space[14],
                  paddingVertical: space[12],
                  fontSize: fontSize.body,
                  color: c.slate900,
                }}
              />
              <Text style={{ fontSize: fontSize.caption, color: c.slate400 }}>
                Auto-detected from your GPS location. Edit if needed.
              </Text>
            </View>

            <Text style={{ fontSize: fontSize.body, fontWeight: '600', color: c.slate500, marginTop: space[2] }}>
              Estimated Depth Level
            </Text>

            {/* Depth Options */}
            <View style={{ gap: space[8] }}>
              {/* Ankle deep */}
              <TouchableOpacity
                onPress={() => setDepth('ankle')}
                style={{
                  ...card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: space[14],
                  borderWidth: depth === 'ankle' ? 1.5 : 1,
                  borderColor: depth === 'ankle' ? (storm ? c.blue300 : c.blue600) : c.slate100,
                  shadowColor: depth === 'ankle' ? c.blue400 : c.black,
                  shadowOpacity: depth === 'ankle' ? (storm ? 0.35 : 0.08) : 0.02,
                  shadowRadius: depth === 'ankle' ? 6 : 2,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.slate100, alignItems: 'center', justifyContent: 'center' }}>
                    <Waves size={16} color={depth === 'ankle' ? c.blue600 : c.slate500} />
                  </View>
                  <View>
                    <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900 }}>Ankle Deep</Text>
                    <Text style={{ fontSize: fontSize.caption, color: c.slate500 }}>Around 0.5 ft (15 cm)</Text>
                  </View>
                </View>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: depth === 'ankle' ? 0 : 1.5, borderColor: c.slate300, backgroundColor: depth === 'ankle' ? c.blue600 : c.slate50, alignItems: 'center', justifyContent: 'center' }}>
                  {depth === 'ankle' && <Check size={12} color={c.white} strokeWidth={3} />}
                </View>
              </TouchableOpacity>

              {/* Knee deep */}
              <TouchableOpacity
                onPress={() => setDepth('knee')}
                style={{
                  ...card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: space[14],
                  borderWidth: depth === 'knee' ? 1.5 : 1,
                  borderColor: depth === 'knee' ? (storm ? c.blue300 : c.blue600) : c.slate100,
                  shadowColor: depth === 'knee' ? c.blue400 : c.black,
                  shadowOpacity: depth === 'knee' ? (storm ? 0.35 : 0.08) : 0.02,
                  shadowRadius: depth === 'knee' ? 6 : 2,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.blue100, alignItems: 'center', justifyContent: 'center' }}>
                    <Waves size={16} color={c.blue600} />
                  </View>
                  <View>
                    <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900 }}>Knee Deep</Text>
                    <Text style={{ fontSize: fontSize.caption, color: c.slate500 }}>Around 1.5 ft (45 cm)</Text>
                  </View>
                </View>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: depth === 'knee' ? 0 : 1.5, borderColor: c.slate300, backgroundColor: depth === 'knee' ? c.blue600 : c.slate50, alignItems: 'center', justifyContent: 'center' }}>
                  {depth === 'knee' && <Check size={12} color={c.white} strokeWidth={3} />}
                </View>
              </TouchableOpacity>

              {/* Waist deep */}
              <TouchableOpacity
                onPress={() => setDepth('waist')}
                style={{
                  ...card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: space[14],
                  borderWidth: depth === 'waist' ? 1.5 : 1,
                  borderColor: depth === 'waist' ? (storm ? '#f87171' : c.red500) : c.slate100,
                  shadowColor: depth === 'waist' ? c.red400 : c.black,
                  shadowOpacity: depth === 'waist' ? (storm ? 0.35 : 0.08) : 0.02,
                  shadowRadius: depth === 'waist' ? 6 : 2,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: storm ? 'rgba(239, 68, 68, 0.16)' : c.red50, alignItems: 'center', justifyContent: 'center' }}>
                    <Home size={16} color={storm ? '#f87171' : c.red600} />
                  </View>
                  <View>
                    <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900 }}>Waist Deep / Submerged</Text>
                    <Text style={{ fontSize: fontSize.caption, color: c.slate500 }}>Exceeds 3.0 ft (&gt;90 cm) • Severe</Text>
                  </View>
                </View>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: depth === 'waist' ? 0 : 1.5, borderColor: c.slate300, backgroundColor: depth === 'waist' ? c.red600 : c.slate50, alignItems: 'center', justifyContent: 'center' }}>
                  {depth === 'waist' && <Check size={12} color={c.onInk} strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            </View>

            {/* Passability Status */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space[4] }}>
              <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: c.slate900 }}>
                Passability Status <Text style={{ color: c.red500 }}>*</Text>
              </Text>
              <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: c.slate500 }}>Select vehicle safety</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: space[8] }}>
              {/* Passable for all */}
              <TouchableOpacity
                onPress={() => setPassability('all')}
                style={{
                  ...card,
                  flex: 1,
                  paddingVertical: space[14],
                  paddingHorizontal: space[4],
                  borderWidth: passability === 'all' ? 1.5 : 1,
                  borderColor: passability === 'all' ? (storm ? c.blue300 : c.blue600) : c.slate100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space[6],
                  shadowColor: passability === 'all' ? c.blue400 : c.black,
                  shadowOpacity: passability === 'all' ? (storm ? 0.35 : 0.08) : 0.02,
                  shadowRadius: passability === 'all' ? 6 : 2,
                }}
              >
                <Car size={20} color={passability === 'all' ? (storm ? c.blue300 : c.blue600) : c.slate500} />
                <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: passability === 'all' ? (storm ? c.blue300 : c.blue600) : c.slate700, textAlign: 'center' }}>
                  Passable for All
                </Text>
              </TouchableOpacity>

              {/* Passable: high vehicle */}
              <TouchableOpacity
                onPress={() => setPassability('high')}
                style={{
                  ...card,
                  flex: 1,
                  paddingVertical: space[14],
                  paddingHorizontal: space[4],
                  borderWidth: passability === 'high' ? 1.5 : 1,
                  borderColor: passability === 'high' ? (storm ? c.blue300 : c.blue600) : c.slate100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space[6],
                  shadowColor: passability === 'high' ? c.blue400 : c.black,
                  shadowOpacity: passability === 'high' ? (storm ? 0.35 : 0.08) : 0.02,
                  shadowRadius: passability === 'high' ? 6 : 2,
                }}
              >
                <Truck size={20} color={passability === 'high' ? (storm ? c.blue300 : c.blue600) : c.slate500} />
                <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: passability === 'high' ? (storm ? c.blue300 : c.blue600) : c.slate700, textAlign: 'center' }}>
                  Passable: High Vehicle
                </Text>
              </TouchableOpacity>

              {/* Not passable */}
              <TouchableOpacity
                onPress={() => setPassability('none')}
                style={{
                  ...card,
                  flex: 1,
                  paddingVertical: space[14],
                  paddingHorizontal: space[4],
                  borderWidth: passability === 'none' ? 1.5 : 1,
                  borderColor: passability === 'none' ? (storm ? '#f87171' : c.red600) : c.slate100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space[6],
                  shadowColor: passability === 'none' ? c.red400 : c.black,
                  shadowOpacity: passability === 'none' ? (storm ? 0.35 : 0.08) : 0.02,
                  shadowRadius: passability === 'none' ? 6 : 2,
                }}
              >
                <Ban size={20} color={passability === 'none' ? (storm ? '#f87171' : c.red600) : c.slate500} />
                <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: passability === 'none' ? (storm ? '#f87171' : c.red600) : c.slate700, textAlign: 'center' }}>
                  Not Passable
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 3: Additional Details */}
          <View style={{ gap: space[10] }}>
            <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: c.slate900 }}>
              3. Additional Details <Text style={{ color: c.slate400, fontWeight: '400' }}>(optional)</Text>
            </Text>

            <View style={{ ...card, padding: space[14], minHeight: 126 }}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes (e.g., passable by SUV only, strong current, landmark)..."
                placeholderTextColor={c.slate400}
                multiline
                numberOfLines={3}
                maxLength={1000}
                style={{ fontSize: fontSize.label, color: c.slate900, textAlignVertical: 'top', minHeight: 60 }}
              />

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8], marginTop: space[12] }}>
                {QUICK_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => handleToggleTag(tag)}
                    style={{ paddingHorizontal: space[12], paddingVertical: space[6], backgroundColor: c.slate100, borderRadius: 999 }}
                  >
                    <Text style={{ fontSize: fontSize.body, fontWeight: '500', color: c.slate600 }}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {result ? (
            <View style={{ backgroundColor: c.emerald50, borderWidth: 1, borderColor: c.emerald200, borderRadius: 16, padding: space[14], gap: space[4] }}>
              <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: c.emerald800 }}>
                Report Submitted
              </Text>
              <Text style={{ fontSize: fontSize.body, color: c.emerald700, lineHeight: 18 }}>
                Reference #{result.report_id.slice(0, 8).toUpperCase()} • {result.depth_label} • waiting for moderation.
              </Text>
              {result.possible_duplicate_of ? (
                <Text style={{ fontSize: fontSize.body, color: c.amber800, lineHeight: 18 }}>
                  A recent report nearby may describe the same flood; the desk will merge them if so.
                </Text>
              ) : null}
            </View>
          ) : null}

          {msg ? (
            <View style={{ gap: space[8] }}>
              <Text style={{ fontSize: fontSize.body, textAlign: 'center', fontWeight: '600', color: msgTone === 'error' ? c.red600 : c.green600, lineHeight: 18 }}>
                {msg}
              </Text>
              {msgTone === 'error' && canSubmit ? (
                <TouchableOpacity
                  onPress={() => void handleSubmit()}
                  style={{ alignSelf: 'center', paddingVertical: space[6], paddingHorizontal: space[14], borderRadius: 8, backgroundColor: c.red50, borderWidth: 1, borderColor: c.red200, flexDirection: 'row', alignItems: 'center', gap: space[6] }}
                >
                  <RefreshCw size={12} color={c.red600} />
                  <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: c.red600 }}>Retry Submission</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Submit Button */}
          <View style={{ marginTop: space[2], gap: space[12] }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Submit Flood Report"
              onPress={() => void handleSubmit()}
              disabled={submitting || result !== null}
              activeOpacity={0.9}
              style={{
                backgroundColor: canSubmit ? (storm ? c.white : c.slate900) : (storm ? '#1e293b' : c.slate300),
                paddingVertical: space[16],
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: space[8],
                borderWidth: canSubmit ? 2 : 1,
                borderColor: canSubmit ? (storm ? '#f87171' : '#dc2626') : (storm ? '#334155' : c.slate200),
                shadowColor: canSubmit ? (storm ? '#f87171' : '#dc2626') : c.black,
                shadowOpacity: canSubmit ? (storm ? 0.45 : 0.2) : 0,
                shadowRadius: canSubmit ? 10 : 0,
                elevation: canSubmit ? 4 : 0,
              }}
            >
              {submitting ? (
                <ActivityIndicator color={storm ? c.slate900 : c.white} />
              ) : (
                <>
                  <Send size={16} color={canSubmit ? (storm ? '#fca5a5' : c.white) : c.slate500} />
                  <Text style={{ fontSize: fontSize.subtitle, fontWeight: '800', color: canSubmit ? (storm ? c.slate900 : c.white) : c.slate500 }}>
                    {result ? 'Report Submitted' : locationState === 'locating' ? 'Waiting for GPS…' : 'Submit Report'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={{ fontSize: fontSize.micro, color: c.slate500, textAlign: 'center', lineHeight: 16, paddingHorizontal: space[12] }}>
              Reports are reviewed before they redirect traffic • Emergency? Activate{' '}
              <Text
                onPress={() => router.push('/(tabs)/sos')}
                style={{ fontWeight: '700', color: c.red500 }}
              >
                Rescue SOS
              </Text>
              .
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
