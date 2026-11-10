import React, { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react-native';
import { useAuth } from '../../auth';
import { Avatar } from '../../components/Avatar';
import { BackButton } from '../../components/BackButton';
import { useDialog } from '../../components/Dialog';
import { enqueueReport, isOffline, newClientId } from '../../offline';
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
  { id: 'ankle', label: 'Ankle deep', detail: 'Around 0.5 ft (15 cm)', cm: 15, api: 'ANKLE' },
  { id: 'knee',  label: 'Knee deep',  detail: 'Around 1.5 ft (45 cm)', cm: 45, api: 'KNEE' },
  { id: 'waist', label: 'Waist deep / Submerged', detail: 'Exceeds 3.0 ft (>90 cm) • Severe', cm: 90, api: 'IMPASSABLE' },
];

const QUICK_TAGS = ['+ Fast current', '+ Open manhole', '+ Stalled vehicles'];

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
  const [barangay, setBarangay] = useState('');
  const [photo, setPhoto] = useState<(ReportPhoto & { capturedAt: string }) | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [position, setPosition] = useState<Location.LocationObjectCoords | null>(null);
  const [fixAt, setFixAt] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('locating');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgTone, setMsgTone] = useState<'error' | 'info'>('info');
  const [result, setResult] = useState<ReportCreated | null>(null);
  const { c, mode } = useTheme();

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

    const selected = DEPTH_OPTIONS.find((d) => d.id === depth)!;

    const confirmed = await confirm({
      title: 'Submit report?',
      message: `${selected.label} at your current pin${photo ? ' with a photo' : ''}. The moderation desk reviews it before it shows on the map.`,
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
      capturedAt: photo?.capturedAt ?? new Date().toISOString(),
      photo: photo ? { uri: photo.uri, name: photo.name, type: photo.type } : null,
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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.white }}>
      <StatusBar barStyle={mode === 'storm' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={{ paddingTop: space[10], paddingBottom: space[10], paddingHorizontal: space[20], backgroundColor: c.white, borderBottomWidth: 1, borderColor: c.slate50 }}>
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
                Report Hazard
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
            <Avatar name={user?.name || user?.email} size={32} />
          </View>
        </View>

        {/* Subheader */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[2] }}>
          <BackButton
            onPress={() => {
              // A half-filled report (photo, notes, barangay) would be lost silently.
              if (!photo && !notes.trim() && !barangay.trim()) {
                router.back();
                return;
              }
              void confirm({
                title: 'Discard this report?',
                message: 'The photo, notes and location pin you entered are not saved.',
                confirmLabel: 'Discard',
                destructive: true,
              }).then((confirmed) => confirmed && router.back());
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6], backgroundColor: c.blue50, paddingHorizontal: space[12], paddingVertical: space[6], borderRadius: 999 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.blue500 }} />
            <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: c.blue800 }}>Moderation Queue</Text>
          </View>
        </View>
      </View>

      {/* Scrollable Content */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
<ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space[20], paddingTop: space[10], paddingBottom: space[32], gap: space[20] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 18, padding: space[16], flexDirection: 'row', gap: space[14] }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(224,242,254,0.7)', alignItems: 'center', justifyContent: 'center' }}>
            <Droplet size={20} color={c.sky600} />
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
            <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900 }}>
              1. Take a photo <Text style={{ color: c.slate400, fontWeight: '400' }}>(optional)</Text>
            </Text>
            <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: c.blue600 }}>Speeds up verification</Text>
          </View>

          {photo ? (
            <View style={{ borderWidth: 1, borderColor: c.slate200, borderRadius: 18, overflow: 'hidden', backgroundColor: c.surface }}>
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
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], paddingHorizontal: space[12], paddingVertical: space[7], backgroundColor: c.red50, borderRadius: 999 }}
                >
                  <X size={13} color={c.red700} />
                  <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: c.red700 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ borderWidth: 1.5, borderColor: c.slate200, borderStyle: 'dashed', borderRadius: 18, paddingVertical: space[22], paddingHorizontal: space[16], alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.white, shadowColor: c.black, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.slate100, marginBottom: space[6] }}>
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
          <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900 }}>
            2. Location & Depth <Text style={{ color: c.red500 }}>*</Text>
          </Text>

          {/* GPS card */}
          <View style={{ borderWidth: 1, borderColor: c.slate200, borderRadius: 18, padding: space[14], flexDirection: 'row', alignItems: 'center', gap: space[12], backgroundColor: c.white, shadowColor: c.black, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: locationState === 'ready' ? c.emerald50 : c.blue50, alignItems: 'center', justifyContent: 'center' }}>
              {locationState === 'locating' ? (
                <ActivityIndicator color={c.blue600} />
              ) : (
                <MapPin size={20} color={locationState === 'ready' ? c.emerald600 : c.blue600} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.micro, fontWeight: '800', color: c.slate400, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {locationState === 'ready' ? 'GPS PIN' : 'DATE & GPS'}
              </Text>
              {locationState === 'ready' && position ? (
                <>
                  <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900, marginTop: space[1] }}>
                    {formatCoordinate(position.latitude, 'N', 'S')}, {formatCoordinate(position.longitude, 'E', 'W')}
                  </Text>
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

          {/* Barangay */}
          <View style={{ borderWidth: 1, borderColor: c.slate200, borderRadius: 14, paddingHorizontal: space[14], paddingVertical: space[10], backgroundColor: c.white }}>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '800', color: c.slate400, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Barangay (optional)
            </Text>
            <TextInput
              value={barangay}
              onChangeText={setBarangay}
              placeholder="e.g. Barangay 309"
              placeholderTextColor={c.slate400}
              maxLength={120}
              style={{ fontSize: fontSize.label, color: c.slate900, paddingVertical: space[4] }}
            />
          </View>

          <Text style={{ fontSize: fontSize.body, fontWeight: '500', color: c.slate500, marginTop: space[2] }}>
            Estimated Depth Level
          </Text>

          {/* Depth Options */}
          <View style={{ gap: space[8] }}>
            {/* Ankle deep */}
            <TouchableOpacity
              onPress={() => setDepth('ankle')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[14], borderRadius: 18, borderWidth: depth === 'ankle' ? 1.5 : 1, borderColor: depth === 'ankle' ? c.blue500 : c.slate200, backgroundColor: depth === 'ankle' ? c.blue50 : c.white }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.slate100, alignItems: 'center', justifyContent: 'center' }}>
                  <Waves size={16} color={c.slate500} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900 }}>Ankle deep</Text>
                  <Text style={{ fontSize: fontSize.caption, color: c.slate500 }}>Around 0.5 ft (15 cm)</Text>
                </View>
              </View>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: depth === 'ankle' ? 0 : 1.5, borderColor: c.slate300, backgroundColor: depth === 'ankle' ? c.slate900 : c.slate50, alignItems: 'center', justifyContent: 'center' }}>
                {depth === 'ankle' && <Check size={12} color={c.white} strokeWidth={3} />}
              </View>
            </TouchableOpacity>

            {/* Knee deep */}
            <TouchableOpacity
              onPress={() => setDepth('knee')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[14], borderRadius: 18, borderWidth: depth === 'knee' ? 1.5 : 1, borderColor: depth === 'knee' ? c.blue500 : c.slate200, backgroundColor: depth === 'knee' ? c.blue50 : c.white }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.blue100, alignItems: 'center', justifyContent: 'center' }}>
                  <Waves size={16} color={c.blue600} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900 }}>Knee deep</Text>
                  <Text style={{ fontSize: fontSize.caption, color: c.slate500 }}>Around 1.5 ft (45 cm)</Text>
                </View>
              </View>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: depth === 'knee' ? 0 : 1.5, borderColor: c.slate300, backgroundColor: depth === 'knee' ? c.slate900 : c.slate50, alignItems: 'center', justifyContent: 'center' }}>
                {depth === 'knee' && <Check size={12} color={c.white} strokeWidth={3} />}
              </View>
            </TouchableOpacity>

            {/* Waist deep */}
            <TouchableOpacity
              onPress={() => setDepth('waist')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[14], borderRadius: 18, borderWidth: depth === 'waist' ? 1.5 : 1, borderColor: depth === 'waist' ? c.red500 : c.slate200, backgroundColor: depth === 'waist' ? c.red50 : c.white }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.red50, alignItems: 'center', justifyContent: 'center' }}>
                  <Home size={16} color={c.red500} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900 }}>Waist deep / Submerged</Text>
                  <Text style={{ fontSize: fontSize.caption, color: c.slate500 }}>Exceeds 3.0 ft (&gt;90 cm) • Severe</Text>
                </View>
              </View>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: depth === 'waist' ? 0 : 1.5, borderColor: c.slate300, backgroundColor: depth === 'waist' ? c.red600 : c.slate50, alignItems: 'center', justifyContent: 'center' }}>
                {depth === 'waist' && <Check size={12} color={c.white} strokeWidth={3} />}
              </View>
            </TouchableOpacity>
          </View>

          {/* Passability Status */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space[4] }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: c.slate900 }}>
              Passability Status <Text style={{ color: c.red500 }}>*</Text>
            </Text>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: c.slate500 }}>Select vehicle safety</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: space[8] }}>
            {/* Passable for all */}
            <TouchableOpacity
              onPress={() => setPassability('all')}
              style={{ flex: 1, paddingVertical: space[14], paddingHorizontal: space[4], borderRadius: 18, borderWidth: passability === 'all' ? 1.5 : 1, borderColor: passability === 'all' ? c.slate900 : c.slate200, backgroundColor: passability === 'all' ? c.slate900 : c.white, alignItems: 'center', justifyContent: 'center', gap: space[6] }}
            >
              <Car size={20} color={passability === 'all' ? c.white : c.slate900} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: passability === 'all' ? c.white : c.slate900, textAlign: 'center' }}>
                Passable for all
              </Text>
            </TouchableOpacity>

            {/* Passable: high vehicle */}
            <TouchableOpacity
              onPress={() => setPassability('high')}
              style={{ flex: 1, paddingVertical: space[14], paddingHorizontal: space[4], borderRadius: 18, borderWidth: passability === 'high' ? 1.5 : 1, borderColor: passability === 'high' ? c.slate900 : c.slate200, backgroundColor: passability === 'high' ? c.slate900 : c.white, alignItems: 'center', justifyContent: 'center', gap: space[6] }}
            >
              <Truck size={20} color={passability === 'high' ? c.white : c.slate900} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: passability === 'high' ? c.white : c.slate900, textAlign: 'center' }}>
                Passable: high vehicle
              </Text>
            </TouchableOpacity>

            {/* Not passable */}
            <TouchableOpacity
              onPress={() => setPassability('none')}
              style={{ flex: 1, paddingVertical: space[14], paddingHorizontal: space[4], borderRadius: 18, borderWidth: passability === 'none' ? 1.5 : 1, borderColor: passability === 'none' ? c.sky600 : c.slate200, borderStyle: passability === 'none' ? 'dashed' : 'solid', backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', gap: space[6] }}
            >
              <Ban size={20} color={passability === 'none' ? c.sky600 : c.slate400} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: passability === 'none' ? c.sky600 : c.slate500, textAlign: 'center' }}>
                Not passable
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 3: Additional Details */}
        <View style={{ gap: space[10] }}>
          <Text style={{ fontSize: fontSize.lead, fontWeight: '700', color: c.slate900 }}>
            3. Additional details <Text style={{ color: c.slate400, fontWeight: '400' }}>(optional)</Text>
          </Text>

          <View style={{ borderWidth: 1, borderColor: c.slate200, borderRadius: 18, padding: space[14], backgroundColor: c.white, minHeight: 126 }}>
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
              Report submitted
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
            onPress={() => void handleSubmit()}
            disabled={submitting || result !== null}
            style={{ backgroundColor: canSubmit ? c.slate900 : c.slate400, paddingVertical: space[16], borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space[8], shadowColor: c.black, shadowOpacity: canSubmit ? 0.1 : 0, shadowRadius: 8, elevation: canSubmit ? 3 : 0 }}
          >
            {submitting ? (
              <ActivityIndicator color={c.white} />
            ) : (
              <>
                <Send size={16} color={c.white} />
                <Text style={{ fontSize: fontSize.subtitle, fontWeight: '700', color: c.white }}>
                  {result ? 'Report submitted' : locationState === 'locating' ? 'Waiting for GPS…' : 'Submit Report'}
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
