import React, { useState } from 'react';
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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Waves,
  Bell,
  ChevronLeft,
  Droplet,
  Camera,
  MapPin,
  Check,
  Home,
  Car,
  Truck,
  Ban,
  Send,
} from 'lucide-react-native';
import { useAuth } from '../../auth';
import { ApiError, createSOS } from '../../api';

type Depth = 'ankle' | 'knee' | 'waist';
type Passability = 'all' | 'high' | 'none';

const DEPTH_OPTIONS: { id: Depth; label: string; detail: string; cm: number }[] = [
  { id: 'ankle', label: 'Ankle deep', detail: 'Around 0.5 ft (15 cm)', cm: 15 },
  { id: 'knee',  label: 'Knee deep',  detail: 'Around 1.5 ft (45 cm)', cm: 45 },
  { id: 'waist', label: 'Waist deep / Submerged', detail: 'Exceeds 3.0 ft (>90 cm) • Severe', cm: 90 },
];

const QUICK_TAGS = ['+ Fast current', '+ Open manhole', '+ Stalled vehicles'];

export default function ReportScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [depth, setDepth] = useState<Depth>('knee');
  const [passability, setPassability] = useState<Passability>('high');
  const [notes, setNotes] = useState('');
  const [photoAttached, setPhotoAttached] = useState(false);
  const [locationName, setLocationName] = useState('Rizal Avenue, Sta. C');
  const [locationDetail, setLocationDetail] = useState('Near Doroteo Jose LRT Station');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

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

  function handleAddPhoto() {
    setPhotoAttached((prev) => !prev);
    if (!photoAttached) {
      Alert.alert('Photo Added', 'Waterline photo attached (+15 Civic Karma queued).');
    }
  }

  function handleChangeLocation() {
    Alert.prompt
      ? Alert.prompt('Change Location', 'Enter detected road or landmark:', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (val) => {
              if (val?.trim()) setLocationName(val.trim());
            },
          },
        ])
      : Alert.alert('Location Pinned', `${locationName} (${locationDetail})`);
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setMsg('');
    try {
      const selected = DEPTH_OPTIONS.find((d) => d.id === depth)!;
      const passText =
        passability === 'all'
          ? 'Passable for all'
          : passability === 'high'
          ? 'Passable: high vehicle'
          : 'Not passable';
      const note = `Community hazard report: ${selected.label} (~${selected.cm} cm) at ${locationName}. Passability: ${passText}${
        notes ? ' — ' + notes : ''
      }${photoAttached ? ' [Photo Evidence Attached]' : ''}`;

      await createSOS({ latitude: 14.6033, longitude: 120.9822, note });
      setMsg('Report submitted. Live dispatch and nearby commuters notified.');
      setTimeout(() => router.replace('/(tabs)/home'), 1200);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      setMsg(
        apiError?.status === 401
          ? 'Sign in to submit a report.'
          : apiError?.status === 429
          ? `${apiError.message} Reports are rate-limited to prevent false floods.`
          : 'Submission failed. Please try again.'
      );
      setSubmitting(false);
    }
  }

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
            <TouchableOpacity onPress={() => Alert.alert('Notifications', 'Live broadcast channels are synced.')}>
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
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e40af' }}>Live Dispatch Sync</Text>
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
              Your real-time report alerts emergency rescue units and redirects fellow commuters away from dangerous depths.
            </Text>
          </View>
        </View>

        {/* Section 1: Photo */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>
              1. Take a photo <Text style={{ color: '#94a3b8', fontWeight: '400' }}>(optional)</Text>
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>Earn +15 Civic Karma</Text>
          </View>

          <View style={{ borderWidth: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 18, paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafbfc' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 6 }}>
              <Camera size={22} color="#2563eb" />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>
              Snap waterline against curb or vehicles
            </Text>
            <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {photoAttached ? '✓ waterline_sample.jpg (1.4MB attached)' : 'JPG, PNG up to 10MB'}
            </Text>
            <TouchableOpacity
              onPress={handleAddPhoto}
              style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: photoAttached ? '#dcfce7' : '#eff6ff', borderRadius: 999, borderWidth: 1, borderColor: photoAttached ? '#bbf7d0' : '#dbeafe' }}
            >
              <Camera size={14} color={photoAttached ? '#15803d' : '#1d4ed8'} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: photoAttached ? '#15803d' : '#1d4ed8' }}>
                {photoAttached ? 'Photo Attached' : 'Add Photo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Location & Depth */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>
            2. Location & Depth <Text style={{ color: '#ef4444' }}>*</Text>
          </Text>

          {/* Location Box */}
          <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={20} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                DETECTED LOCATION
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 1 }}>
                {locationName}
              </Text>
              <Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                {locationDetail}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleChangeLocation}
              style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#eff6ff', borderRadius: 10 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1d4ed8' }}>Change</Text>
            </TouchableOpacity>
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
              style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 18, borderWidth: passability === 'none' ? 1.5 : 1, borderColor: passability === 'none' ? '#0284c7' : '#e2e8f0', borderStyle: passability === 'none' ? 'dashed' : 'solid', backgroundColor: passability === 'none' ? '#ffffff' : '#ffffff', alignItems: 'center', justifyContent: 'center', gap: 6 }}
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

        {msg ? (
          <Text style={{ fontSize: 12, textAlign: 'center', fontWeight: '600', color: msg.includes('submitted') ? '#16a34a' : '#dc2626' }}>
            {msg}
          </Text>
        ) : null}

        {/* Submit Button */}
        <View style={{ marginTop: 2, gap: 12 }}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{ backgroundColor: '#061d38', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Send size={16} color="#ffffff" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'center', lineHeight: 16, paddingHorizontal: 12 }}>
            Data verified under open civic protocol • Emergency? Dial{' '}
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
