import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Navigation, Clock, Route, ShieldCheck, AlertTriangle, Car } from 'lucide-react-native';

const RECENT = ['Market Market, Taguig', 'Shaw Boulevard, Mandaluyong', 'Bagong Ilog, Pasig'];

const FLOOD_SAFE_ROUTE = {
  name: 'Flood-Safe Bypass Route',
  dist: '5.2 km',
  time: '~14 min',
  note: 'Avoids all verified hazard zones',
  safe: true,
};

const DIRECT_ROUTE = {
  name: 'Direct Route (Current Road)',
  dist: '4.1 km',
  time: '~22 min (+delay)',
  note: 'Water level 22 cm detected at underpass',
  safe: false,
};

export default function RouteScreen() {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const [selected, setSelected] = useState<'safe' | 'direct'>('safe');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <ArrowLeft size={18} color="#1e293b" />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>Flood-Safe Route Planner</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">

        {/* Origin / Destination input */}
        <View style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' }} />
            <TextInput
              editable={false}
              value="Current Location (GPS)"
              style={{ flex: 1, fontSize: 13, color: '#475569' }}
            />
          </View>
          <View style={{ width: 1, height: 20, backgroundColor: '#cbd5e1', marginLeft: 5 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <MapPin size={16} color="#2563eb" />
            <TextInput
              value={destination}
              onChangeText={setDestination}
              placeholder="Search destination or drop pin"
              style={{ flex: 1, fontSize: 13, color: '#0f172a' }}
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Recent */}
        <View>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Recent</Text>
          <View style={{ gap: 6 }}>
            {RECENT.map((loc) => (
              <TouchableOpacity
                key={loc}
                onPress={() => setDestination(loc)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}
              >
                <Clock size={15} color="#94a3b8" />
                <Text style={{ fontSize: 13, color: '#475569' }}>{loc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Route options */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
              Hydrologic Route Suggestions
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Car size={12} color="#475569" />
              <Text style={{ fontSize: 10, color: '#475569', fontWeight: '600' }}>28 cm Clearance</Text>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            {/* Flood-safe */}
            <TouchableOpacity
              onPress={() => setSelected('safe')}
              style={{ backgroundColor: selected === 'safe' ? '#eff6ff' : '#f8fafc', borderWidth: selected === 'safe' ? 2 : 1, borderColor: selected === 'safe' ? '#2563eb' : '#e2e8f0', borderRadius: 16, padding: 16 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e3a8a' }}>{FLOOD_SAFE_ROUTE.name}</Text>
                  <Text style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>{FLOOD_SAFE_ROUTE.time} • {FLOOD_SAFE_ROUTE.dist}</Text>
                </View>
                <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>RECOMMENDED</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', padding: 8, borderRadius: 8 }}>
                <ShieldCheck size={14} color="#16a34a" />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#15803d' }}>{FLOOD_SAFE_ROUTE.note}</Text>
              </View>
            </TouchableOpacity>

            {/* Direct / hazard */}
            <TouchableOpacity
              onPress={() => setSelected('direct')}
              style={{ backgroundColor: '#f8fafc', borderWidth: selected === 'direct' ? 2 : 1, borderColor: selected === 'direct' ? '#ef4444' : '#e2e8f0', borderRadius: 16, padding: 16, opacity: 0.85 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>{DIRECT_ROUTE.name}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{DIRECT_ROUTE.time} • {DIRECT_ROUTE.dist}</Text>
                </View>
                <View style={{ backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#fecaca' }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#dc2626' }}>HAZARD</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} color="#dc2626" />
                <Text style={{ fontSize: 11, color: '#dc2626' }}>{DIRECT_ROUTE.note}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Start navigation */}
        <TouchableOpacity
          style={{ backgroundColor: '#0f172a', paddingVertical: 16, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Navigation size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Start Navigation</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
