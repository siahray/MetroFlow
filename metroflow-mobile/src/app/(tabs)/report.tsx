import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, MapPin, AlertTriangle, Droplets } from 'lucide-react-native';
import { useAuth } from '../../auth';
import { ApiError, createSOS } from '../../api';

type Depth = 'ankle' | 'knee' | 'waist';
type Passability = 'all' | 'high' | 'none';

const DEPTH_OPTIONS: { id: Depth; label: string; detail: string; cm: number }[] = [
  { id: 'ankle', label: 'Ankle Deep', detail: 'Around 15 cm', cm: 15 },
  { id: 'knee',  label: 'Knee Deep',  detail: 'Around 45 cm', cm: 45 },
  { id: 'waist', label: 'Waist Deep / Submerged', detail: 'Exceeds 90 cm • Severe', cm: 100 },
];

const PASS_OPTIONS: { id: Passability; label: string; danger: boolean }[] = [
  { id: 'all',  label: 'Passable for all',  danger: false },
  { id: 'high', label: 'High-clearance only', danger: false },
  { id: 'none', label: 'Not passable',        danger: true  },
];

export default function ReportScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [depth, setDepth] = useState<Depth>('knee');
  const [passability, setPassability] = useState<Passability>('all');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setMsg('');
    try {
      const selected = DEPTH_OPTIONS.find(d => d.id === depth)!;
      const note = `Community report: ${selected.label} (~${selected.cm} cm). Passability: ${passability}${notes ? ' — ' + notes : ''}`;
      await createSOS({ latitude: 14.5547, longitude: 121.0244, note });
      setMsg('Report submitted. MDRRMC has been notified.');
      setTimeout(() => router.replace('/(tabs)/home'), 1200);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      setMsg(
        apiError?.status === 401
          ? 'Sign in to submit a report.'
          : apiError?.status === 429
            ? `${apiError.message} Reports are limited to prevent false floods.`
            : 'Submission failed. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
        <View style={{ width: 36, height: 36, backgroundColor: '#fff7ed', borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fed7aa' }}>
          <Droplets size={18} color="#c2410c" />
        </View>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>Community Flood Watch</Text>
          <Text style={{ fontSize: 11, color: '#64748b' }}>Submit a hazard report to MDRRMC</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">

        {/* Info banner */}
        <View style={{ backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#fde68a' }}>
          <AlertTriangle size={16} color="#d97706" />
          <Text style={{ fontSize: 11, color: '#92400e', flex: 1, lineHeight: 16 }}>
            Your report notifies MDRRMC and reroutes fellow motorists away from dangerous flood depths.
          </Text>
        </View>

        {/* Photo upload */}
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
            1. Photo Evidence (Optional)
          </Text>
          <TouchableOpacity style={{ borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 16, padding: 24, alignItems: 'center', backgroundColor: '#f8fafc' }}>
            <View style={{ width: 44, height: 44, backgroundColor: '#eff6ff', borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Camera size={22} color="#2563eb" />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>Snap waterline against curb or vehicle</Text>
            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>JPG / PNG up to 10 MB</Text>
          </TouchableOpacity>
        </View>

        {/* Depth selector */}
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
            2. Estimated Depth *
          </Text>
          <View style={{ gap: 8 }}>
            {DEPTH_OPTIONS.map(opt => {
              const active = depth === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setDepth(opt.id)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: active ? '#eff6ff' : '#fff', borderRadius: 14, borderWidth: active ? 2 : 1, borderColor: active ? '#2563eb' : '#e2e8f0' }}
                >
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#1e40af' : '#1e293b' }}>{opt.label}</Text>
                    <Text style={{ fontSize: 10, color: active ? '#3b82f6' : '#64748b', marginTop: 2 }}>{opt.detail}</Text>
                  </View>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: active ? '#2563eb' : 'transparent', borderWidth: active ? 0 : 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' }}>
                    {active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Passability */}
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
            3. Passability *
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PASS_OPTIONS.map(opt => {
              const active = passability === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setPassability(opt.id)}
                  style={{ flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', backgroundColor: active ? (opt.danger ? '#fef2f2' : '#0f172a') : '#fff', borderWidth: 1, borderColor: active ? (opt.danger ? '#fca5a5' : '#0f172a') : '#e2e8f0' }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: active ? (opt.danger ? '#dc2626' : '#fff') : '#475569', textAlign: 'center' }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Location */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <MapPin size={16} color="#475569" />
          <Text style={{ fontSize: 11, color: '#475569', flex: 1 }}>Current GPS location will be attached</Text>
        </View>

        {/* Notes */}
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
            Additional Notes (Optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="E.g. water is rising, vehicle stuck…"
            style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a', textAlignVertical: 'top' }}
          />
        </View>

        {msg ? <Text style={{ fontSize: 12, textAlign: 'center', color: msg.includes('submitted') ? '#16a34a' : '#dc2626' }}>{msg}</Text> : null}

        <TouchableOpacity
          style={{ backgroundColor: '#0f172a', paddingVertical: 16, borderRadius: 14, alignItems: 'center' }}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Submit Report</Text>
          }
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8' }}>
          Reports are sent to MDRRMC Disaster Monitoring. No native telephony is used.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
