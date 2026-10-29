import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Waves,
  Bell,
  Droplet,
  AlertTriangle,
  ChevronRight,
  CloudRain,
  Compass,
  Navigation,
  Plus,
  Minus,
  Search,
  Mic,
  Briefcase,
  Home as HomeIcon,
  Activity,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react-native';
import { useAuth } from '../../auth';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [zoomLevel, setZoomLevel] = useState(1);
  const displayName = user?.name || 'Carlos Reyes';

  function handleHazardPress() {
    Alert.alert(
      'Hazard Surge Alert — Zone 4B',
      'Flooded roads detected along low-lying corridors. Rerouting algorithms are actively steering drivers away from critical surge zones.',
      [
        { text: 'View on Map', onPress: () => router.push('/(tabs)/map') },
        { text: 'Report Hazard', onPress: () => router.push('/(tabs)/report') },
        { text: 'Dismiss', style: 'cancel' },
      ]
    );
  }

  function handleDestinationSelect(dest: string) {
    router.push({
      pathname: '/route',
      params: { destination: dest },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
            <Waves size={18} color="#2563eb" />
          </View>
          <View>
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 12 }}>
              METROFLOW
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', lineHeight: 22 }}>
              Home
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={() => Alert.alert('Notifications', 'All municipal safety streams are synchronized.')}>
            <Bell size={20} color="#475569" />
          </TouchableOpacity>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80' }}
            style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#f8fafc' }}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* User Bar */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ position: 'relative' }}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80' }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#38bdf8', borderWidth: 1.5, borderColor: '#ffffff' }} />
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>{displayName}</Text>
              <Text style={{ fontSize: 10, color: '#64748b' }}>Active Driver • Fleet</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
            <Droplet size={11} color="#2563eb" />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#1e40af' }}>Sensor Online</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb', marginLeft: 2 }} />
          </View>
        </View>

        {/* Hazard Surge Alert Banner */}
        <TouchableOpacity
          onPress={handleHazardPress}
          activeOpacity={0.88}
          style={{ marginHorizontal: 16, marginTop: 14, marginBottom: 14, backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#3b82f6', borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#b91c1c', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#b91c1c' }}>
              HAZARD SURGE ALERT • <Text style={{ fontWeight: '600', color: '#ef4444' }}>Zone 4B</Text>
            </Text>
            <Text style={{ fontSize: 11, color: '#334155', marginTop: 1 }}>
              Flooded roads detected • <Text style={{ fontWeight: '700', color: '#0f172a' }}>Tap to review d...</Text>
            </Text>
          </View>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <ChevronRight size={16} color="#0f172a" />
          </View>
        </TouchableOpacity>

        {/* Live Map Area */}
        <View style={{ marginHorizontal: 16, height: 280, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', position: 'relative', backgroundColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
          {/* Street Map Background */}
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }}
            style={{ width: '100%', height: '100%', opacity: 0.82 }}
            resizeMode="cover"
          />

          {/* Map Overlay: Live SafeFlow Routing Badge */}
          <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#061d38', letterSpacing: 0.5 }}>
              LIVE SAFEFLOW ROUTING
            </Text>
          </View>

          {/* Map Overlay: Weather Tag */}
          <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 5, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' }}>
            <CloudRain size={13} color="#64748b" />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#334155' }}>
              26°C • Mist
            </Text>
          </View>

          {/* Hazard Zone Highlight on Map */}
          <TouchableOpacity
            onPress={handleHazardPress}
            style={{ position: 'absolute', top: '28%', left: '26%', width: 90, height: 90, backgroundColor: 'rgba(239,68,68,0.22)', borderWidth: 2, borderColor: '#ef4444', borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#b91c1c', borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
              <Waves size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>

          {/* User Location Beacon on Map */}
          <View style={{ position: 'absolute', top: '56%', right: '28%', width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(37,99,235,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#0284c7' }} />
            </View>
          </View>

          {/* Map Right Floating Controls */}
          <View style={{ position: 'absolute', right: 12, top: '35%', gap: 8, zIndex: 10 }}>
            <TouchableOpacity
              onPress={() => Alert.alert('Compass', 'Map aligned to magnetic North.')}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: '#f1f5f9' }}
            >
              <Compass size={16} color="#0284c7" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert('Current Position', 'Centered on Rizal Ave / Doroteo Jose Station.')}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#061d38', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}
            >
              <Navigation size={15} color="#ffffff" />
            </TouchableOpacity>

            <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 17, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: '#f1f5f9' }}>
              <TouchableOpacity
                onPress={() => setZoomLevel((z) => Math.min(z + 0.2, 2))}
                style={{ width: 34, height: 32, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderColor: '#f1f5f9' }}
              >
                <Plus size={15} color="#334155" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setZoomLevel((z) => Math.max(z - 0.2, 0.6))}
                style={{ width: 34, height: 32, alignItems: 'center', justifyContent: 'center' }}
              >
                <Minus size={15} color="#334155" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Estuary Surge Tag */}
          <View style={{ position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.96)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
              <Waves size={15} color="#2563eb" />
            </View>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748b', lineHeight: 12 }}>Estuary Surge</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b', lineHeight: 14 }}>+0.12m Safe</Text>
            </View>
          </View>
        </View>

        {/* Elevated Path Planner Search Card */}
        <TouchableOpacity
          onPress={() => router.push('/route')}
          activeOpacity={0.9}
          style={{ marginHorizontal: 16, marginTop: 14, backgroundColor: '#ffffff', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={18} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              ELEVATED PATH PLANNER
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#94a3b8', marginTop: 1 }}>
              Where to? Search destination...
            </Text>
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
            <Mic size={16} color="#64748b" />
          </View>
        </TouchableOpacity>

        {/* Horizontal Quick Destinations */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10, marginTop: 14 }}
        >
          {/* Work Terminal */}
          <TouchableOpacity
            onPress={() => handleDestinationSelect('Work Terminal')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
              <Briefcase size={14} color="#2563eb" />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e293b', lineHeight: 14 }}>Work Terminal</Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#0284c7', lineHeight: 12 }}>12.4 km • Clear</Text>
            </View>
          </TouchableOpacity>

          {/* Home Bay */}
          <TouchableOpacity
            onPress={() => handleDestinationSelect('Home Bay')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
              <HomeIcon size={14} color="#475569" />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e293b', lineHeight: 14 }}>Home Bay</Text>
              <Text style={{ fontSize: 10, color: '#64748b', lineHeight: 12 }}>6.8 km</Text>
            </View>
          </TouchableOpacity>

          {/* Civic Center */}
          <TouchableOpacity
            onPress={() => handleDestinationSelect('Civic Center')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={14} color="#475569" />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e293b', lineHeight: 14 }}>Civic Center</Text>
              <Text style={{ fontSize: 10, color: '#64748b', lineHeight: 12 }}>3.1 km</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* Urban Drainage Status Card */}
        <View style={{ marginHorizontal: 16, marginTop: 18, backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#38bdf8' }} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#061d38' }}>Urban Drainage Status</Text>
            </View>
            <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#475569' }}>Updated 2m ago</Text>
            </View>
          </View>

          {/* Metric Grid */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Open Pumping */}
            <View style={{ flex: 1, backgroundColor: '#eff6ff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#dbeafe' }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748b' }}>Open Pumping</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#061d38', marginTop: 3 }}>14/16</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563eb', marginTop: 2 }}>92% Cap</Text>
            </View>

            {/* Blocked Pave */}
            <View style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#fee2e2' }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748b' }}>Blocked Pave</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#dc2626', marginTop: 3 }}>3 Segs</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#ef4444', marginTop: 2 }}>Avoid Area</Text>
            </View>

            {/* Tide Level */}
            <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748b' }}>Tide Level</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1e293b', marginTop: 3 }}>+1.1m</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#0284c7', marginTop: 2 }}>Ebbing Low</Text>
            </View>
          </View>

          {/* Footer of Card */}
          <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={14} color="#10b981" />
              <Text style={{ fontSize: 10, fontWeight: '500', color: '#64748b' }}>Municipal sensors validated</Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/map')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>Full Drainage Map</Text>
              <ArrowRight size={12} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
