import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  Waves,
  Bell,
  ChevronLeft,
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
import {
  ApiError,
  submitReport,
  type ReportCreated,
  type ReportDepth,
  type ReportPhoto,
} from '../../api';

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
  quality: 0.6,
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

  const readPosition = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationState('denied');
        setLocationError('Location permission is required to pin where you saw the flood.');
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
      if (asset.fileSize && asset.fileSize > PHOTO_MAX_BYTES) {
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

    setSubmitting(true);
    setMsg('');
    setResult(null);

    try {
      const selected = DEPTH_OPTIONS.find((d) => d.id === depth)!;
      // Passability is a driver observation too, so it travels in the narrative
      // the moderator reads rather than inventing a field the API does not have.
      const narrative = [`Passability: ${PASSABILITY_LABELS[passability]}.`, notes.trim()]
        .filter(Boolean)
        .join(' ');

      const created = await submitReport({
        depthLevel: selected.api,
        latitude: position.latitude,
        longitude: position.longitude,
        narrative,
        barangay: barangay.trim() || null,
        capturedAt: photo?.capturedAt ?? new Date().toISOString(),
        photo: photo
          ? { uri: photo.uri, name: photo.name, type: photo.type }
          : null,
      });

      setResult(created);
      setMsgTone('info');
      setMsg('Report received. The moderation desk now sees it in the queue.');
      setTimeout(() => router.replace('/(tabs)/home'), 2500);
    } catch (error) {
      setMsgTone('error');
      setMsg(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && !result && locationState === 'ready' && position !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{ paddingTop: 10, paddingBottom: 10, paddingHorizontal: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#f8fafc' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
              <Waves size={18} color="#2563eb" />
            </View>
            <View>
              <Text style={{ fontSize: 9, fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 12 }}>
                METROFLOW
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', lineHeight: 20 }}>
                Report Hazard
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
              <Bell size={20} color="#475569" />
            </TouchableOpacity>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80' }}
              style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}
            />
          </View>
        </View>

        {/* Subheader */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
          >
            <ChevronLeft size={18} color="#475569" />
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#475569' }}>Back</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#3b82f6' }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e40af' }}>Moderation Queue</Text>
          </View>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={{ backgroundColor: '#f4f7fa', borderRadius: 18, padding: 16, flexDirection: 'row', gap: 14 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(224,242,254,0.7)', alignItems: 'center', justifyContent: 'center' }}>
            <Droplet size={20} color="#0284c7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#061d38', marginBottom: 2 }}>
              Community Flood Watch
            </Text>
            <Text style={{ fontSize: 12, color: '#64748b', lineHeight: 18 }}>
              Your report joins the moderation queue. Once verified, it becomes a hazard that reroutes fellow drivers.
            </Text>
          </View>
        </View>

        {!user ? (
          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 14, padding: 12 }}>
            <Text style={{ fontSize: 12, color: '#9a3412', flex: 1, lineHeight: 18 }}>
              You are browsing as a guest. Sign in from the profile tab to submit reports.
            </Text>
          </View>
        ) : null}

        {/* Section 1: Photo */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>
              1. Take a photo <Text style={{ color: '#94a3b8', fontWeight: '400' }}>(optional)</Text>
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>Speeds up verification</Text>
          </View>

          {photo ? (
            <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, overflow: 'hidden', backgroundColor: '#fafbfc' }}>
              <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 170 }} resizeMode="cover" />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>
                    {photo.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Captured {formatClock(photo.capturedAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setPhoto(null)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fef2f2', borderRadius: 999 }}
                >
                  <X size={13} color="#b91c1c" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#b91c1c' }}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ borderWidth: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 18, paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafbfc' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 6 }}>
                {photoBusy ? <ActivityIndicator color="#2563eb" /> : <Camera size={22} color="#2563eb" />}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>
                Snap the waterline against a curb or vehicle
              </Text>
              <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                JPEG, PNG or WebP up to 4 MB
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => void handleCapture(true)}
                  disabled={photoBusy}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#eff6ff', borderRadius: 999, borderWidth: 1, borderColor: '#dbeafe', opacity: photoBusy ? 0.6 : 1 }}
                >
                  <Camera size={14} color="#1d4ed8" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1d4ed8' }}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void handleCapture(false)}
                  disabled={photoBusy}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#ffffff', borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0', opacity: photoBusy ? 0.6 : 1 }}
                >
                  <ImagePlus size={14} color="#475569" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>Library</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Section 2: Location & Depth */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>
            2. Location & Depth <Text style={{ color: '#ef4444' }}>*</Text>
          </Text>

          {/* GPS card */}
          <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: locationState === 'ready' ? '#ecfdf5' : '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
              {locationState === 'locating' ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <MapPin size={20} color={locationState === 'ready' ? '#059669' : '#2563eb'} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {locationState === 'ready' ? 'GPS PIN' : 'DATE & GPS'}
              </Text>
              {locationState === 'ready' && position ? (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 1 }}>
                    {formatCoordinate(position.latitude, 'N', 'S')}, {formatCoordinate(position.longitude, 'E', 'W')}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                    {position.accuracy != null ? `±${Math.round(position.accuracy)} m • ` : ''}
                    {fixAt ? `Pin taken ${formatClock(fixAt)}` : 'Pin taken'}
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 12, color: locationState === 'denied' ? '#b91c1c' : '#64748b', marginTop: 2, lineHeight: 17 }}>
                  {locationState === 'locating'
                    ? 'Reading your position…'
                    : locationError ?? 'Position unavailable.'}
                </Text>
              )}
            </View>
            {locationState !== 'ready' && locationState !== 'locating' ? (
              <TouchableOpacity
                onPress={handleRetryLocation}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#eff6ff', borderRadius: 10 }}
              >
                <RefreshCw size={12} color="#1d4ed8" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1d4ed8' }}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Barangay */}
          <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#ffffff' }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Barangay (optional)
            </Text>
            <TextInput
              value={barangay}
              onChangeText={setBarangay}
              placeholder="e.g. Barangay 309"
              placeholderTextColor="#94a3b8"
              maxLength={120}
              style={{ fontSize: 13, color: '#0f172a', paddingVertical: 4 }}
            />
          </View>

          <Text style={{ fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 }}>
            Estimated Depth Level
          </Text>

          {/* Depth Options */}
          <View style={{ gap: 8 }}>
            {/* Ankle deep */}
            <TouchableOpacity
              onPress={() => setDepth('ankle')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 18, borderWidth: depth === 'ankle' ? 1.5 : 1, borderColor: depth === 'ankle' ? '#3b82f6' : '#e2e8f0', backgroundColor: depth === 'ankle' ? '#eff6ff' : '#ffffff' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                  <Waves size={16} color="#64748b" />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#061d38' }}>Ankle deep</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Around 0.5 ft (15 cm)</Text>
                </View>
              </View>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: depth === 'ankle' ? 0 : 1.5, borderColor: '#cbd5e1', backgroundColor: depth === 'ankle' ? '#061d38' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                {depth === 'ankle' && <Check size={12} color="#ffffff" strokeWidth={3} />}
              </View>
            </TouchableOpacity>

            {/* Knee deep */}
            <TouchableOpacity
              onPress={() => setDepth('knee')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 18, borderWidth: depth === 'knee' ? 1.5 : 1, borderColor: depth === 'knee' ? '#3b82f6' : '#e2e8f0', backgroundColor: depth === 'knee' ? '#eff6ff' : '#ffffff' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
                  <Waves size={16} color="#2563eb" />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#061d38' }}>Knee deep</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Around 1.5 ft (45 cm)</Text>
                </View>
              </View>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: depth === 'knee' ? 0 : 1.5, borderColor: '#cbd5e1', backgroundColor: depth === 'knee' ? '#061d38' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                {depth === 'knee' && <Check size={12} color="#ffffff" strokeWidth={3} />}
              </View>
            </TouchableOpacity>

            {/* Waist deep */}
            <TouchableOpacity
              onPress={() => setDepth('waist')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 18, borderWidth: depth === 'waist' ? 1.5 : 1, borderColor: depth === 'waist' ? '#ef4444' : '#e2e8f0', backgroundColor: depth === 'waist' ? '#fef2f2' : '#ffffff' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' }}>
                  <Home size={16} color="#ef4444" />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#061d38' }}>Waist deep / Submerged</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Exceeds 3.0 ft (&gt;90 cm) • Severe</Text>
                </View>
              </View>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: depth === 'waist' ? 0 : 1.5, borderColor: '#cbd5e1', backgroundColor: depth === 'waist' ? '#dc2626' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                {depth === 'waist' && <Check size={12} color="#ffffff" strokeWidth={3} />}
              </View>
            </TouchableOpacity>
          </View>

          {/* Passability Status */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#061d38' }}>
              Passability Status <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748b' }}>Select vehicle safety</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Passable for all */}
            <TouchableOpacity
              onPress={() => setPassability('all')}
              style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 18, borderWidth: passability === 'all' ? 1.5 : 1, borderColor: passability === 'all' ? '#061d38' : '#e2e8f0', backgroundColor: passability === 'all' ? '#061d38' : '#ffffff', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Car size={20} color={passability === 'all' ? '#ffffff' : '#061d38'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: passability === 'all' ? '#ffffff' : '#061d38', textAlign: 'center' }}>
                Passable for all
              </Text>
            </TouchableOpacity>

            {/* Passable: high vehicle */}
            <TouchableOpacity
              onPress={() => setPassability('high')}
              style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 18, borderWidth: passability === 'high' ? 1.5 : 1, borderColor: passability === 'high' ? '#061d38' : '#e2e8f0', backgroundColor: passability === 'high' ? '#061d38' : '#ffffff', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Truck size={20} color={passability === 'high' ? '#ffffff' : '#061d38'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: passability === 'high' ? '#ffffff' : '#061d38', textAlign: 'center' }}>
                Passable: high vehicle
              </Text>
            </TouchableOpacity>

            {/* Not passable */}
            <TouchableOpacity
              onPress={() => setPassability('none')}
              style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 18, borderWidth: passability === 'none' ? 1.5 : 1, borderColor: passability === 'none' ? '#0284c7' : '#e2e8f0', borderStyle: passability === 'none' ? 'dashed' : 'solid', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Ban size={20} color={passability === 'none' ? '#0284c7' : '#94a3b8'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: passability === 'none' ? '#0284c7' : '#64748b', textAlign: 'center' }}>
                Not passable
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 3: Additional Details */}
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>
            3. Additional details <Text style={{ color: '#94a3b8', fontWeight: '400' }}>(optional)</Text>
          </Text>

          <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 14, backgroundColor: '#ffffff', minHeight: 126 }}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes (e.g., passable by SUV only, strong current, landmark)..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              maxLength={1000}
              style={{ fontSize: 13, color: '#0f172a', textAlignVertical: 'top', minHeight: 60 }}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {QUICK_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => handleToggleTag(tag)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f1f5f9', borderRadius: 999 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#475569' }}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {result ? (
          <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 16, padding: 14, gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#065f46' }}>
              Report submitted
            </Text>
            <Text style={{ fontSize: 12, color: '#047857', lineHeight: 18 }}>
              Reference #{result.report_id.slice(0, 8).toUpperCase()} • {result.depth_label} • waiting for moderation.
            </Text>
            {result.possible_duplicate_of ? (
              <Text style={{ fontSize: 12, color: '#92400e', lineHeight: 18 }}>
                A recent report nearby may describe the same flood; the desk will merge them if so.
              </Text>
            ) : null}
          </View>
        ) : null}

        {msg ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, textAlign: 'center', fontWeight: '600', color: msgTone === 'error' ? '#dc2626' : '#16a34a', lineHeight: 18 }}>
              {msg}
            </Text>
            {msgTone === 'error' && canSubmit ? (
              <TouchableOpacity
                onPress={() => void handleSubmit()}
                style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={12} color="#dc2626" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#dc2626' }}>Retry Submission</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Submit Button */}
        <View style={{ marginTop: 2, gap: 12 }}>
          <TouchableOpacity
            onPress={() => void handleSubmit()}
            disabled={submitting || result !== null}
            style={{ backgroundColor: canSubmit ? '#061d38' : '#94a3b8', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: '#000', shadowOpacity: canSubmit ? 0.1 : 0, shadowRadius: 8, elevation: canSubmit ? 3 : 0 }}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Send size={16} color="#ffffff" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>
                  {result ? 'Report submitted' : locationState === 'locating' ? 'Waiting for GPS…' : 'Submit Report'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'center', lineHeight: 16, paddingHorizontal: 12 }}>
            Reports are reviewed before they redirect traffic • Emergency? Dial{' '}
            <Text style={{ fontWeight: '700', color: '#2563eb' }}>911</Text> or activate{' '}
            <Text
              onPress={() => router.push('/(tabs)/sos')}
              style={{ fontWeight: '700', color: '#ef4444' }}
            >
              Rescue SOS
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
