import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Waves,
  Bell,
  ArrowLeft,
  Info,
  Target,
  Lock,
  MapPin,
  CheckCircle2,
  ArrowUp,
  Car,
  User,
  BriefcaseMedical,
  ArrowRight,
  Phone,
  ShieldCheck,
} from 'lucide-react-native';
import { ApiError, createSOS } from '../../api';

type SituationType = 'vehicle' | 'pedestrian' | 'medical';

const PLACEHOLDER_COORDS = { latitude: 14.6033, longitude: 120.9822 };

export default function SOSScreen() {
  const router = useRouter();
  const [situation, setSituation] = useState<SituationType>('pedestrian');
  const [sending, setSending] = useState(false);

  async function handleSOS() {
    if (sending) return;
    setSending(true);
    try {
      const situationLabel =
        situation === 'vehicle'
          ? 'Vehicle Stuck in Floodwaters'
          : situation === 'medical'
          ? 'Medical Need / Health Crisis'
          : 'Pedestrian / Stranded Citizen';

      await createSOS({
        latitude: PLACEHOLDER_COORDS.latitude,
        longitude: PLACEHOLDER_COORDS.longitude,
        note: `PRIORITY RESCUE REQUEST: ${situationLabel} at Rizal Ave near LRT Station (Metro District Sector 4 • Northbound). Water hazard level: 1.5 ft critical.`,
      });

      Alert.alert(
        'Rescue Dispatched',
        'Your priority distress request has been registered with Metro Emergency Dispatch. Civic response units in Sector 4 are en route.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }]
      );
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      const needsSignIn = apiError?.status === 401;
      const throttled = apiError?.status === 429;

      Alert.alert(
        needsSignIn ? 'Sign in required' : throttled ? 'SOS limit reached' : 'Dispatch Alert',
        needsSignIn
          ? 'Please sign in or continue to submit priority rescue requests.'
          : throttled
          ? `${apiError?.message ?? 'Rate limited.'} For immediate life-saving support, dial 911.`
          : 'Priority signal failed. If this is life-threatening, dial 911 directly.'
      );
      setSending(false);
    }
  }

  function handleCall911() {
    Alert.alert(
      'Emergency Call',
      'Confirm emergency call to 911 national hotline?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 911',
          style: 'destructive',
          onPress: () => {
            Linking.openURL('tel:911').catch(() => {
              Alert.alert('Calling Unavailable', 'Please dial 911 directly on your handset.');
            });
          },
        },
      ]
    );
  }

  function handleInfo() {
    Alert.alert(
      'Priority SOS Protocol',
      'Active Geo-Lock transmits telemetry and sub-meter location directly to the MetroFlow LGU Emergency Operations Center (EOC).'
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, backgroundColor: '#f8fafc' }}>
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
                Sos Rescue Dispatch
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => Alert.alert('Notifications', 'SOS live channel monitoring active.')}>
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
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(226,232,240,0.6)', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={18} color="#334155" />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#fee2e2' }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#ef4444' }} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              PRIORITY SOS LINE
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleInfo}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(226,232,240,0.6)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Info size={18} color="#334155" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Graphic */}
        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 12, position: 'relative' }}>
          <View style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 }}>
                <Target size={38} color="#2563eb" />
              </View>
            </View>
          </View>

          {/* Overlapping Geo-Lock Badge */}
          <View style={{ position: 'absolute', bottom: -10, backgroundColor: '#061d38', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 2, borderColor: '#ffffff', flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 }}>
            <Lock size={11} color="#ffffff" />
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Active Geo-Lock
            </Text>
          </View>
        </View>

        {/* Title & Description */}
        <View style={{ alignItems: 'center', marginTop: 18, marginBottom: 18, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#061d38', marginBottom: 6 }}>
            Need Assistance?
          </Text>
          <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 }}>
            If you are stranded or your vehicle is trapped in rising floodwaters, request immediate deployment. Civic dispatch units are active in your sector.
          </Text>
        </View>

        {/* Info Cards */}
        <View style={{ gap: 12, marginBottom: 18 }}>
          {/* Identified Location */}
          <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 14, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={20} color="#061d38" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  IDENTIFIED LOCATION
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <CheckCircle2 size={12} color="#94a3b8" />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#94a3b8' }}>±3m accuracy</Text>
                </View>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a' }}>
                Rizal Ave near LRT Station
              </Text>
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Metro District Sector 4 • Northbound
              </Text>
            </View>
          </View>

          {/* Water Hazard Level */}
          <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 14, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' }}>
              <Waves size={20} color="#ef4444" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  WATER HAZARD LEVEL
                </Text>
                <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff', textTransform: 'uppercase' }}>
                    CRITICAL
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a' }}>
                  1.5 ft
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <ArrowUp size={11} color="#ef4444" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#ef4444' }}>
                    Rising fast (+0.2ft/10m)
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Sensor Station #RZA-09 telemetry
              </Text>
            </View>
          </View>
        </View>

        {/* Situation Type */}
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>Situation Type</Text>
            <Text style={{ fontSize: 11, fontWeight: '500', color: '#64748b' }}>Tap to refine</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Vehicle Stuck */}
            <TouchableOpacity
              onPress={() => setSituation('vehicle')}
              style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 18, borderWidth: situation === 'vehicle' ? 1.5 : 1, borderColor: situation === 'vehicle' ? '#061d38' : '#e2e8f0', backgroundColor: situation === 'vehicle' ? '#061d38' : '#ffffff', alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 }}
            >
              <Car size={20} color={situation === 'vehicle' ? '#ffffff' : '#061d38'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: situation === 'vehicle' ? '#ffffff' : '#061d38', textAlign: 'center' }}>
                Vehicle Stuck
              </Text>
            </TouchableOpacity>

            {/* Pedestrian */}
            <TouchableOpacity
              onPress={() => setSituation('pedestrian')}
              style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 18, borderWidth: situation === 'pedestrian' ? 1.5 : 1, borderColor: situation === 'pedestrian' ? '#061d38' : '#e2e8f0', backgroundColor: situation === 'pedestrian' ? '#061d38' : '#ffffff', alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 }}
            >
              <User size={20} color={situation === 'pedestrian' ? '#ffffff' : '#061d38'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: situation === 'pedestrian' ? '#ffffff' : '#061d38', textAlign: 'center' }}>
                Pedestrian
              </Text>
            </TouchableOpacity>

            {/* Medical Need */}
            <TouchableOpacity
              onPress={() => setSituation('medical')}
              style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 18, borderWidth: situation === 'medical' ? 1.5 : 1, borderColor: situation === 'medical' ? '#061d38' : '#e2e8f0', backgroundColor: situation === 'medical' ? '#061d38' : '#ffffff', alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 }}
            >
              <BriefcaseMedical size={20} color={situation === 'medical' ? '#ffffff' : '#061d38'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: situation === 'medical' ? '#ffffff' : '#061d38', textAlign: 'center' }}>
                Medical Need
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 10, marginBottom: 14 }}>
          {/* Primary SOS CTA */}
          <TouchableOpacity
            onPress={handleSOS}
            disabled={sending}
            style={{ backgroundColor: '#061d38', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 }}
          >
            {sending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#ffffff', letterSpacing: 0.8 }}>
                  SOS
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>
                  Request Rescue
                </Text>
                <ArrowRight size={16} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>

          {/* Secondary Buttons Row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={handleCall911}
              style={{ flex: 1, paddingVertical: 14, backgroundColor: '#eff6ff', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Phone size={14} color="#ef4444" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1d4ed8' }}>
                Call 911 Directly
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{ flex: 1, paddingVertical: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Monitored Response Footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
          <ShieldCheck size={14} color="#0284c7" />
          <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748b' }}>
            Metro Emergency Dispatch • 24/7 Monitored Response
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
