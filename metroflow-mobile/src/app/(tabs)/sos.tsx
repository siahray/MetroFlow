import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LifeBuoy, MapPin, AlertOctagon } from 'lucide-react-native';
import { createSOS } from '../../api';

/** Placeholder coords — in production, replace with expo-location GPS fix */
const PLACEHOLDER_COORDS = { latitude: 14.554729, longitude: 121.024445 };

export default function SOSScreen() {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  async function handleSOS() {
    if (sending) return;
    setSending(true);
    try {
      await createSOS({
        latitude: PLACEHOLDER_COORDS.latitude,
        longitude: PLACEHOLDER_COORDS.longitude,
        note: 'Public SOS distress signal — citizen stranded in floodwaters.',
      });
      Alert.alert('SOS Sent', 'Your distress signal has been sent to MDRRMC Emergency Dispatch.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/home') },
      ]);
    } catch {
      Alert.alert('Failed', 'Could not send SOS. Check your connection and try again.');
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.18)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f87171' }} />
          <Text style={{ color: '#f87171', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Priority SOS Line</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Text style={{ color: '#64748b', fontSize: 22 }}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        {/* SOS pulse ring */}
        <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(220,38,38,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
          <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: '#dc2626', borderWidth: 4, borderColor: '#f87171', alignItems: 'center', justifyContent: 'center' }}>
            <LifeBuoy size={52} color="#ffffff" />
          </View>
        </View>

        <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 10 }}>Need Immediate Rescue?</Text>
        <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', maxWidth: 300, lineHeight: 20, marginBottom: 28 }}>
          If you are stranded or your vehicle is trapped in rising floodwaters, send a distress signal. MDRRMC emergency units will receive your location.
        </Text>

        {/* Location card */}
        <View style={{ backgroundColor: 'rgba(30,41,59,0.8)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155', width: '100%', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <MapPin size={14} color="#38bdf8" />
            <Text style={{ fontSize: 11, color: '#94a3b8' }}>Identified Location</Text>
            <Text style={{ fontSize: 11, color: '#2dd4bf', fontWeight: '700', marginLeft: 'auto' }}>±3 m accuracy</Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Metro District Sector 4</Text>
          <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Coordinates will be attached to your request</Text>
        </View>

        <Text style={{ fontSize: 10, color: '#475569', textAlign: 'center', marginBottom: 28 }}>
          SOS alerts MDRRMC rescue units with your GPS location. No native telephony used.
        </Text>
      </View>

      {/* Action buttons */}
      <View style={{ gap: 10, paddingHorizontal: 16, paddingBottom: 28 }}>
        <TouchableOpacity
          style={{ backgroundColor: '#dc2626', paddingVertical: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}
          onPress={handleSOS}
          disabled={sending}
        >
          {sending
            ? <ActivityIndicator color="#fff" />
            : (
              <>
                <AlertOctagon size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>SEND DISTRESS SIGNAL</Text>
              </>
            )
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={{ backgroundColor: 'rgba(30,41,59,0.6)', paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}
          onPress={() => router.back()}
          disabled={sending}
        >
          <Text style={{ color: '#cbd5e1', fontWeight: '700', fontSize: 13 }}>Cancel — I'm Safe</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
