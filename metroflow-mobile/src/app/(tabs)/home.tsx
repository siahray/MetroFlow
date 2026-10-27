import { View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  Search,
  AlertTriangle,
  Droplet,
  ChevronRight,
  ShieldCheck,
  Navigation,
  LifeBuoy,
} from 'lucide-react-native';
import { useAuth } from '../../auth';

/** Pasig City Metro Manila approx center */
const INITIAL_REGION = {
  latitude: 14.5547,
  longitude: 121.0244,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const displayName = user?.name || 'Public Driver';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'PD';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        {/* Live map */}
        <MapView
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={INITIAL_REGION}
        >
          <Marker coordinate={{ latitude: 14.554, longitude: 121.024 }}>
            <View style={{ backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>Flood Zone</Text>
            </View>
          </Marker>
        </MapView>

        {/* Top search bar overlay */}
        <View style={{ position: 'absolute', top: 12, left: 12, right: 12 }}>
          {/* User chip */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.85)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, gap: 8 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#38bdf8', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 10 }}>{initials}</Text>
              </View>
              <Text style={{ color: '#e2e8f0', fontSize: 11, fontWeight: '600' }}>{displayName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(8,145,178,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(8,145,178,0.3)', gap: 5 }}>
              <Droplet size={11} color="#22d3ee" />
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#22d3ee' }}>Sensor Online</Text>
            </View>
          </View>

          {/* Route search bar */}
          <TouchableOpacity
            style={{ backgroundColor: 'rgba(255,255,255,0.97)', padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 }}
            onPress={() => router.push('/route')}
          >
            <Search size={18} color="#94a3b8" />
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e293b' }}>ELEVATED PATH PLANNER</Text>
              <Text style={{ fontSize: 10, color: '#64748b' }}>Where to? Search flood-safe destination…</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom sheet */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
          <View style={{ width: 36, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 14 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>Flood Status: Monitoring</Text>
              <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Check route before departure</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
              <ShieldCheck size={13} color="#16a34a" />
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803d' }}>Active</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#0f172a', paddingVertical: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              onPress={() => router.push('/route')}
            >
              <Navigation size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Plan Route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#fff7ed', paddingVertical: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#fed7aa' }}
              onPress={() => router.push('/(tabs)/report')}
            >
              <AlertTriangle size={16} color="#c2410c" />
              <Text style={{ color: '#c2410c', fontWeight: '700', fontSize: 13 }}>Report Hazard</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={{ backgroundColor: '#dc2626', paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onPress={() => router.push('/(tabs)/sos')}
          >
            <LifeBuoy size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>EMERGENCY SOS</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
