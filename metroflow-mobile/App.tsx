import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, TextInput, SafeAreaView } from 'react-native';
import { 
  Waves, ArrowRight, Map as MapIcon, AlertTriangle, 
  LifeBuoy, User, Search, Droplet, 
  Camera, XCircle, Truck, Car, ChevronRight, X, Menu,
  Shield, ShieldCheck, Navigation, MapPin, ArrowLeft, Info,
  LogOut, Mail
} from 'lucide-react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { AuthProvider, useAuth } from './src/auth';
import { login as apiLogin, register as apiRegister, sendVerification as apiSendVerification, createSOS } from './src/api';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const SplashScreen = ({ navigation }: any) => (
  <SafeAreaView style={[styles.container, { backgroundColor: '#f8fafc' }]}>
    <View style={{ padding: 24, flex: 1, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(219,234,254,0.8)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb', marginRight: 6 }} />
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1d4ed8' }}>Live Flood Network</Text>
        </View>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Civic Transit Safe</Text>
      </View>

      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, backgroundColor: '#2563eb', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Waves size={40} color="#fff" />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0f172a' }}>MetroFlow</Text>
        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Safer Roads. Stronger Communities.</Text>
        
        <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 20, maxWidth: 280 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ShieldAlert size={16} color="#2563eb" />
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1e293b' }}>Real-Time Hydrologic Rerouting</Text>
          </View>
          <Text style={{ fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 14 }}>
            Calculates safe corridors based on your vehicle's ground clearance profile (28 cm).
          </Text>
        </View>
      </View>

      <View style={{ gap: 12, marginBottom: 20 }}>
        <TouchableOpacity style={{ backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }} onPress={() => navigation.replace('Login')}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Log In</Text>
          <ArrowRight size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={{ backgroundColor: '#eff6ff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }} onPress={() => navigation.replace('MainApp')}>
          <Text style={{ color: '#1e3a8a', fontWeight: 'bold', fontSize: 14 }}>Continue as Guest</Text>
        </TouchableOpacity>
        <Text style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8' }}>By continuing, you agree to the Safe Transit Guidelines.</Text>
      </View>
    </View>
  </SafeAreaView>
);

function ShieldAlert({ size, color }: any) {
  return <Shield size={size} color={color} />;
}

const HomeScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const displayName = user?.name || "Driver";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  return (
  <SafeAreaView style={styles.container}>
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
      <View style={styles.row}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{initials || "DR"}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>{displayName}</Text>
          <Text style={{ fontSize: 9, fontWeight: '600', color: '#2563eb' }}>{user?.role || "Active Driver • Fleet Member"}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfeff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#cffafe' }}>
        <Droplet size={10} color="#0891b2" />
        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#155e75', marginLeft: 4 }}>Sensor Online</Text>
      </View>
    </View>

    <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        <AlertTriangle size={16} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>HAZARD SURGE • Flooded roads detected</Text>
      </View>
      <ChevronRight size={16} color="#fff" />
    </View>

    <View style={{ flex: 1, backgroundColor: '#cbd5e1', position: 'relative' }}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 14.5995,
          longitude: 121.0223,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Marker coordinate={{ latitude: 14.5995, longitude: 121.0223 }}>
          <View style={{ backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>Water Level: 42 cm</Text>
          </View>
        </Marker>
      </MapView>
      <View style={{ position: 'absolute', top: 16, left: 16, right: 16 }}>
        <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.98)', padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }} onPress={() => navigation.navigate('Route')}>
          <Search size={18} color="#94a3b8" />
          <View>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1e293b' }}>ELEVATED PATH PLANNER</Text>
            <Text style={{ fontSize: 10, color: '#64748b' }}>Where to? Search flood-safe destination...</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>

    <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f1f5f9' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase' }}>Urban Drainage Status</Text>
        <Text style={{ fontSize: 9, color: '#94a3b8' }}>Updated 2m ago</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
          <Text style={{ fontSize: 9, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Open Pumping</Text>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginTop: 4 }}>14/16</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#fef2f2', padding: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fee2e2' }}>
          <Text style={{ fontSize: 9, color: '#ef4444', fontWeight: 'bold', textTransform: 'uppercase' }}>Blocked Pave</Text>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#991b1b', marginTop: 4 }}>3 Segs</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
          <Text style={{ fontSize: 9, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Tide Level</Text>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginTop: 4 }}>+1.1m</Text>
        </View>
      </View>
    </View>
  </SafeAreaView>
  );
};

const ReportScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [depth, setDepth] = React.useState<"ankle" | "knee" | "waist">("knee");
  const [submitting, setSubmitting] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const submitReport = async () => {
    if (submitting) return;
    setSubmitting(true);
    setMsg("");
    try {
      const depthCm = depth === "ankle" ? 15 : depth === "knee" ? 45 : 120;
      const note = `Community report: ${depth} deep (~${depthCm} cm) by ${user?.name || "mobile user"}`;
      await createSOS({ latitude: 14.5995, longitude: 121.0223, note });
      setMsg("Report submitted to dispatch.");
      setTimeout(() => navigation.navigate("MainApp"), 800);
    } catch (e) {
      setMsg("Failed to submit report");
      setSubmitting(false);
    }
  };

  return (
  <SafeAreaView style={styles.container}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <ArrowLeft size={20} color="#1e293b" />
      </TouchableOpacity>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a' }}>Community Flood Watch</Text>
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
        <Droplet size={18} color="#2563eb" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1e40af' }}>Community Flood Watch</Text>
          <Text style={{ fontSize: 10, color: '#2563eb', marginTop: 2, lineHeight: 14 }}>
            Your real-time report alerts emergency rescue units and redirects fellow commuters away from dangerous depths.
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 8 }}>1. Snap Waterline Photo (Optional)</Text>
      <TouchableOpacity style={{ borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 16, padding: 24, alignItems: 'center', backgroundColor: '#f8fafc', marginBottom: 16 }}>
        <View style={{ width: 40, height: 40, backgroundColor: '#eff6ff', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <Camera size={20} color="#2563eb" />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>Snap waterline against curb or vehicle</Text>
        <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>JPG, PNG up to 10MB</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 8 }}>2. Estimated Depth Level *</Text>
      <View style={{ gap: 8, marginBottom: 16 }}>
        <TouchableOpacity onPress={() => setDepth("ankle")} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: depth === "ankle" ? '#eff6ff' : '#fff', borderRadius: 12, borderWidth: depth === "ankle" ? 2 : 1, borderColor: depth === "ankle" ? '#2563eb' : '#e2e8f0' }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: depth === "ankle" ? '#1e40af' : '#1e293b' }}>Ankle Deep</Text>
            <Text style={{ fontSize: 9, color: depth === "ankle" ? '#3b82f6' : '#64748b' }}>Around 15 cm depth</Text>
          </View>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: depth === "ankle" ? '#2563eb' : 'transparent', borderWidth: depth === "ankle" ? 0 : 1, borderColor: '#cbd5e1' }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDepth("knee")} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: depth === "knee" ? '#eff6ff' : '#fff', borderRadius: 12, borderWidth: depth === "knee" ? 2 : 1, borderColor: depth === "knee" ? '#2563eb' : '#e2e8f0' }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: depth === "knee" ? '#1e40af' : '#1e293b' }}>Knee Deep</Text>
            <Text style={{ fontSize: 9, color: depth === "knee" ? '#3b82f6' : '#64748b' }}>Around 45 cm depth</Text>
          </View>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: depth === "knee" ? '#2563eb' : 'transparent', borderWidth: depth === "knee" ? 0 : 1, borderColor: '#cbd5e1' }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDepth("waist")} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: depth === "waist" ? '#eff6ff' : '#fff', borderRadius: 12, borderWidth: depth === "waist" ? 2 : 1, borderColor: depth === "waist" ? '#2563eb' : '#e2e8f0' }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: depth === "waist" ? '#1e40af' : '#1e293b' }}>Waist Deep / Submerged</Text>
            <Text style={{ fontSize: 9, color: depth === "waist" ? '#3b82f6' : '#64748b' }}>Exceeds 90 cm depth • Severe</Text>
          </View>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: depth === "waist" ? '#2563eb' : 'transparent', borderWidth: depth === "waist" ? 0 : 1, borderColor: '#cbd5e1' }} />
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 8 }}>3. Passability Status *</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        <TouchableOpacity style={{ flex: 1, padding: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
          <Car size={20} color="#475569" />
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569', marginTop: 6 }}>Passable for all</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, padding: 10, backgroundColor: '#0f172a', borderRadius: 12, alignItems: 'center' }}>
          <Truck size={20} color="#fff" />
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#fff', marginTop: 6 }}>High vehicle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, padding: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
          <XCircle size={20} color="#ef4444" />
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569', marginTop: 6 }}>Not passable</Text>
        </TouchableOpacity>
      </View>

      {msg ? <Text style={{ fontSize: 11, color: '#2563eb', textAlign: 'center', marginBottom: 8 }}>{msg}</Text> : null}

      <TouchableOpacity style={{ backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }} onPress={submitReport} disabled={submitting}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{submitting ? "Submitting..." : "Submit Report"}</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>
  );
};

const SOSScreen = ({ navigation }: any) => (
  <SafeAreaView style={[styles.container, { backgroundColor: '#0f172a' }]}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}>
        <Text style={{ color: '#f87171', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>PRIORITY SOS LINE</Text>
      </View>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <X size={20} color="#94a3b8" />
      </TouchableOpacity>
    </View>

    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
      <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(220,38,38,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#dc2626', borderWidth: 4, borderColor: '#f87171', alignItems: 'center', justifyContent: 'center' }}>
          <LifeBuoy size={48} color="#fff" />
        </View>
      </View>
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 }}>Need Immediate Rescue?</Text>
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', maxWidth: 280, lineHeight: 18 }}>
        If you are stranded or your vehicle is trapped in rising floodwaters, request immediate deployment. Civic dispatch units are active in your sector.
      </Text>
      <View style={{ backgroundColor: 'rgba(30,41,59,0.8)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155', width: '100%', marginTop: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 11, color: '#94a3b8' }}>IDENTIFIED LOCATION</Text>
          <Text style={{ fontSize: 11, color: '#2dd4bf', fontWeight: 'bold' }}>±3m accuracy</Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>Rizal Ave near LRT Station</Text>
        <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Metro District Sector 4 • Northbound</Text>
      </View>
      <Text style={{ fontSize: 9, color: '#64748b', marginTop: 12, textAlign: 'center' }}>
        SOS will drop a location pin for dispatch (no native telephony)
      </Text>
    </View>

    <View style={{ gap: 10, paddingHorizontal: 16, marginBottom: 20 }}>
      <TouchableOpacity
        style={{ backgroundColor: '#dc2626', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
        onPress={async () => {
          try {
            await createSOS({
              latitude: 14.554729,
              longitude: 121.024445,
              note: 'Mobile SOS request',
            });
            alert('SOS sent successfully');
          } catch (e) {
            alert('Failed to send SOS');
          }
          navigation.replace('MainApp');
        }}
      >
        <AlertTriangle size={18} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>SOS Request Rescue</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ backgroundColor: '#1e293b', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' }} onPress={() => navigation.goBack()}>
        <Text style={{ color: '#cbd5e1', fontWeight: 'bold', fontSize: 11 }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

const ProfileScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const displayName = user?.name || "";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a' }}>Citizen Profile</Text>
      </View>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ backgroundColor: '#f0f9ff', padding: 24, alignItems: 'center', borderBottomWidth: 1, borderColor: '#e0f2fe' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>{initials || "DR"}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a' }}>{displayName || "Fleet Driver"}</Text>
          <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '600', marginTop: 4 }}>{user?.role || "Driver / Fleet Member"}</Text>
          <View style={{ flexDirection: 'row', width: '100%', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderColor: '#bfdbfe' }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Clearance</Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginTop: 4 }}>28 cm</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Alert Sync</Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0284c7', marginTop: 4 }}>Active</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Dispatches</Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginTop: 4 }}>0</Text>
            </View>
          </View>
        </View>
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>CONTACT INFORMATION</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
              <Mail size={16} color="#64748b" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 9, color: '#94a3b8' }}>Civic Dispatch Email</Text>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>{user?.email || "driver@metroflow.ph"}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
              <Car size={16} color="#64748b" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 9, color: '#94a3b8' }}>Registered Vehicle</Text>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>{user?.role || "Emergency Unit"}</Text>
              </View>
            </View>
          </View>

          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>APP SETTINGS</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginBottom: 12 }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }} onPress={() => {}}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MapIcon size={16} color="#64748b" />
                <View>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>Offline Maps & Telemetry</Text>
                  <Text style={{ fontSize: 9, color: '#94a3b8' }}>Visual placeholder only (no download)</Text>
                </View>
              </View>
              <ChevronRight size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={{ backgroundColor: '#fef2f2', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#fee2e2' }} onPress={() => navigation.replace('Splash')}>
            <LogOut size={16} color="#dc2626" />
            <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 11 }}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};


const RouteScreen = ({ navigation }: any) => {
  return (
  <SafeAreaView style={styles.container}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <ArrowLeft size={20} color="#1e293b" />
      </TouchableOpacity>
      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase' }}>Active Route Selection</Text>
      <View style={{ width: 20 }} />
    </View>
    <ScrollView style={{ flex: 1 }}>
      <View style={{ padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderColor: '#e2e8f0', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <Navigation size={16} color="#2563eb" />
          <Text style={{ fontSize: 12, color: '#475569', flex: 1 }}>Current Location (Rizal Ave, Sector 4)</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#2563eb' }}>
          <MapPin size={16} color="#dc2626" />
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#0f172a', flex: 1 }}>Financial District Tower</Text>
        </View>
      </View>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Hydrologic Route Suggestions</Text>
        <View style={{ backgroundColor: '#eff6ff', borderWidth: 2, borderColor: '#2563eb', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e3a8a' }}>Alternative (Bypass Safe)</Text>
              <Text style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>27 min • 10.8 km • Clear of runoff</Text>
            </View>
            <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#fff' }}>RECOMMENDED</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', padding: 8, borderRadius: 8, marginTop: 10 }}>
            <ShieldCheck size={14} color="#059669" />
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#065f46' }}>Safer route avoids flooded area</Text>
          </View>
        </View>
        <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, opacity: 0.8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b' }}>Current Route (Direct)</Text>
              <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>32 min • 12.4 km • +5 min delay</Text>
            </View>
            <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#dc2626' }}>HAZARD</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <AlertTriangle size={12} color="#dc2626" />
            <Text style={{ fontSize: 10, color: '#dc2626' }}>Caution: Water level 22 cm at Underpass</Text>
          </View>
        </View>
        <TouchableOpacity style={{ backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }} onPress={() => navigation.navigate('MainApp')}>
          <Navigation size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Start Safe Navigation</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </SafeAreaView>
  );
};

const LoginScreen = ({ navigation }: any) => {
  const { signIn } = useAuth();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [verificationCode, setVerificationCode] = React.useState("");
  const [codeSent, setCodeSent] = React.useState(false);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sendingCode, setSendingCode] = React.useState(false);

  const handleLogin = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const user = await apiLogin(email, password);
      signIn(user);
      navigation.replace("MainApp");
    } catch (e) {
      setError("Invalid credentials");
      setSubmitting(false);
    }
  };

  const handleSendCode = async () => {
    if (sendingCode) return;
    setSendingCode(true);
    setError("");
    try {
      const res = await apiSendVerification(email);
      setCodeSent(true);
      setError(res.code ? `Code sent (dev): ${res.code}` : "Verification code sent");
    } catch (e: any) {
      setError(e.message || "Failed to send code");
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      if (!name.trim()) {
        throw new Error("Name required");
      }
      if (!codeSent || !verificationCode.trim()) {
        throw new Error("Verification code required");
      }
      const user = await apiRegister({ name, email, password, role: "EMERGENCY_DRIVER", verification_code: verificationCode });
      signIn(user);
      navigation.replace("MainApp");
    } catch (e: any) {
      setError(e.message || "Registration failed");
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      <View style={{ padding: 24, flex: 1 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={18} color="#1e293b" />
          <Text style={{ fontSize: 12, color: '#1e293b' }}>Back</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <View style={{ width: 64, height: 64, backgroundColor: '#2563eb', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Waves size={32} color="#fff" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#0f172a' }}>MetroFlow {mode === "login" ? "Login" : "Sign Up"}</Text>
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {mode === "login" ? "Sign in to access dispatch and routing" : "Create a driver account"}
          </Text>
        </View>

        <View style={{ marginTop: 32, gap: 12 }}>
          {mode === "register" ? (
            <View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155', marginBottom: 6 }}>Full Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
                placeholder="Juan Dela Cruz"
              />
            </View>
          ) : null}
          <View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155', marginBottom: 6 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
              placeholder="driver@metroflow.ph"
            />
          </View>
          <View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155', marginBottom: 6 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
              placeholder="********"
            />
          </View>

          {mode === "register" ? (
            <>
              <TouchableOpacity
                style={{ backgroundColor: '#eff6ff', paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' }}
                onPress={handleSendCode}
                disabled={sendingCode}
              >
                <Text style={{ color: '#1e40af', fontWeight: 'bold', fontSize: 12 }}>
                  {sendingCode ? "Sending..." : codeSent ? "Resend Verification Code" : "Send Verification Code"}
                </Text>
              </TouchableOpacity>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155', marginBottom: 6 }}>Verification Code</Text>
                <TextInput
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="numeric"
                  maxLength={6}
                  style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
                  placeholder="123456"
                />
              </View>
            </>
          ) : null}

          {error ? <Text style={{ fontSize: 11, color: error.includes('dev') ? '#16a34a' : '#dc2626' }}>{error}</Text> : null}

          <TouchableOpacity
            style={{ backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 }}
            onPress={mode === "login" ? handleLogin : handleRegister}
            disabled={submitting}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
              {submitting ? (mode === "login" ? "Signing in..." : "Signing up...") : mode === "login" ? "Sign In" : "Sign Up"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => setMode(mode === "login" ? "register" : "login")}>
            <Text style={{ fontSize: 12, color: '#475569' }}>
              {mode === "login" ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 6 }} onPress={() => navigation.replace("MainApp")}>
            <Text style={{ fontSize: 12, color: '#475569' }}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};


const MainTabs = () => (
  <Tab.Navigator screenOptions={{
    headerShown: false,
    tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#f1f5f9', height: 60 },
    tabBarActiveTintColor: '#2563eb',
    tabBarInactiveTintColor: '#64748b',
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 4 }
  }}>
    <Tab.Screen name="Map" component={HomeScreen} options={{ tabBarIcon: ({ color }) => <MapIcon size={20} color={color} /> }} />
    <Tab.Screen name="Report" component={ReportScreen} options={{ tabBarIcon: ({ color }) => <AlertTriangle size={20} color={color} /> }} />
    <Tab.Screen name="SOS" component={SOSScreen} options={{ tabBarIcon: ({ color }) => <LifeBuoy size={20} color={color} /> }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color }) => <User size={20} color={color} /> }} />
  </Tab.Navigator>
);

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="MainApp" component={MainTabs} />
          <Stack.Screen name="Route" component={RouteScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  row: { flexDirection: 'row', alignItems: 'center' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
