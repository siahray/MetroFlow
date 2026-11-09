import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  Mail,
  Car,
  CarFront,
  Bike,
  Truck,
  Map,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Gauge,
  Pencil,
  Check,
  HelpCircle,
  History,
  Info,
  Moon,
  BellRing,
} from 'lucide-react-native';
import { updateMyName } from '../../api';
import { useAuth } from '../../auth';
import { loadMyVehicle, saveMyVehicle, type MyVehicle, type VehicleType } from '../../myVehicle';
import { savePrefs, usePrefs, type DriverPrefs } from '../../prefs';

import { fontSize, space, colors, useTheme } from '../../theme';

const VEHICLE_TYPE_ICON: Record<VehicleType, typeof Car> = {
  motorcycle: Bike,
  sedan: Car,
  suv: CarFront,
  truck: Truck,
};
const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  motorcycle: 'Motorcycle',
  sedan: 'Sedan',
  suv: 'SUV / Van',
  truck: 'Truck',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signIn, signOut } = useAuth();
  const { mode: themeMode, toggle: toggleTheme } = useTheme();
  const prefs = usePrefs();

  async function handlePrefChange(key: keyof DriverPrefs, value: boolean) {
    await savePrefs({ ...prefs, [key]: value });
  }
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [vehicle, setVehicle] = useState<MyVehicle | null>(null);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [clearanceDraft, setClearanceDraft] = useState('');

  useEffect(() => {
    void loadMyVehicle().then(setVehicle);
  }, []);

  async function handlePickType(type: VehicleType) {
    const next = { type, clearanceCm: vehicle?.clearanceCm ?? 28 };
    setVehicle(next);
    await saveMyVehicle(next);
  }

  function handleEditClearance() {
    setClearanceDraft(String(vehicle?.clearanceCm ?? 28));
    setEditingVehicle(true);
  }

  async function handleSaveClearance() {
    const parsed = Math.round(Number(clearanceDraft));
    if (Number.isFinite(parsed) && parsed > 0 && vehicle) {
      const next = { ...vehicle, clearanceCm: parsed };
      setVehicle(next);
      await saveMyVehicle(next);
    }
    setEditingVehicle(false);
  }

  async function handleSaveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || !user) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const updated = await updateMyName(trimmed);
      signIn(updated);
      setEditingName(false);
    } catch {
      Alert.alert('Could not save', 'Check your connection and try again.');
    } finally {
      setSavingName(false);
    }
  }

  const displayName = user?.name || 'Public Driver';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'PD';

  function handleSignOut() {
    signOut();
    router.replace('/');
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.slate50 }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{ paddingHorizontal: space[16], paddingVertical: space[14], backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.slate100 }}>
        <Text style={{ fontSize: fontSize.heading, fontWeight: '800', color: colors.slate900 }}>Profile</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Avatar card */}
        <View style={{ backgroundColor: colors.white, padding: space[24], alignItems: 'center', borderBottomWidth: 1, borderColor: colors.slate100 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.slate900, alignItems: 'center', justifyContent: 'center', marginBottom: space[12] }}>
            <Text style={{ color: colors.white, fontSize: fontSize.hero, fontWeight: '800' }}>{initials}</Text>
          </View>
          {editingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8], width: '100%' }}>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                autoFocus
                editable={!savingName}
                style={{ flex: 1, fontSize: fontSize.heading, fontWeight: '700', color: colors.slate900, borderBottomWidth: 1, borderColor: colors.slate300, textAlign: 'center', paddingVertical: space[4] }}
              />
              <TouchableOpacity onPress={() => void handleSaveName()} disabled={savingName} hitSlop={8}>
                <Check size={20} color={colors.green600} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[6] }}
              onPress={() => {
                if (!user) return;
                setNameDraft(user.name);
                setEditingName(true);
              }}
              disabled={!user}
            >
              <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: colors.slate900 }}>{displayName}</Text>
              {user ? <Pencil size={13} color={colors.slate400} /> : null}
            </TouchableOpacity>
          )}
          <Text style={{ fontSize: fontSize.body, color: colors.blue600, fontWeight: '600', marginTop: space[4] }}>
            {user?.role && user.role !== 'EMERGENCY_DRIVER' ? user.role : 'Driver'}
          </Text>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', width: '100%', marginTop: space[20], paddingTop: space[16], borderTopWidth: 1, borderColor: colors.slate100, gap: space[0] }}>
            {[
              { label: 'Clearance', value: `${vehicle?.clearanceCm ?? 28} cm`, icon: Gauge, color: colors.slate900 },
              { label: 'Account', value: user ? 'Signed in' : 'Guest', icon: ShieldCheck, color: user ? colors.green600 : colors.slate500 },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <View key={stat.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderColor: colors.slate100 }}>
                  <Text style={{ fontSize: fontSize.tiny, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase', marginBottom: space[4] }}>{stat.label}</Text>
                  <Icon size={14} color={stat.color} />
                  <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: stat.color, marginTop: space[4] }}>{stat.value}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ padding: space[16], gap: space[16] }}>
          {/* Account details */}
          <View style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase', paddingHorizontal: space[16], paddingTop: space[14], paddingBottom: space[8] }}>
              Account & Vehicle
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[16], paddingVertical: space[12], borderTopWidth: 1, borderColor: colors.slate50, gap: space[10] }}>
              <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={15} color={colors.slate500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>Account Email</Text>
                <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: colors.slate900 }}>{user?.email || '—'}</Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: space[16], paddingVertical: space[12], borderTopWidth: 1, borderColor: colors.slate50, gap: space[10] }}>
              <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>My vehicle (for flood-aware routing)</Text>
              <View style={{ flexDirection: 'row', gap: space[8] }}>
                {(Object.keys(VEHICLE_TYPE_ICON) as VehicleType[]).map((type) => {
                  const Icon = VEHICLE_TYPE_ICON[type];
                  const selected = vehicle?.type === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      accessibilityRole="button"
                      accessibilityLabel={VEHICLE_TYPE_LABEL[type]}
                      onPress={() => void handlePickType(type)}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: space[4],
                        paddingVertical: space[10],
                        borderRadius: 10,
                        backgroundColor: selected ? colors.slate900 : colors.slate100,
                      }}
                    >
                      <Icon size={16} color={selected ? colors.white : colors.slate600} />
                      <Text style={{ fontSize: fontSize.tiny, fontWeight: '700', color: selected ? colors.white : colors.slate600 }}>
                        {VEHICLE_TYPE_LABEL[type]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {editingVehicle ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
                  <TextInput
                    value={clearanceDraft}
                    onChangeText={setClearanceDraft}
                    keyboardType="number-pad"
                    autoFocus
                    style={{ flex: 1, fontSize: fontSize.label, fontWeight: '600', color: colors.slate900, borderWidth: 1, borderColor: colors.slate300, borderRadius: 8, paddingHorizontal: space[10], paddingVertical: space[6] }}
                  />
                  <Text style={{ fontSize: fontSize.body, color: colors.slate500 }}>cm</Text>
                  <TouchableOpacity onPress={() => void handleSaveClearance()} hitSlop={8}>
                    <Check size={20} color={colors.green600} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Edit routing clearance"
                  onPress={handleEditClearance}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[6] }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: colors.slate900 }}>
                    Ground clearance: {vehicle?.clearanceCm ?? 28} cm
                  </Text>
                  <Pencil size={12} color={colors.slate400} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Settings */}
          <View style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase', paddingHorizontal: space[16], paddingTop: space[14], paddingBottom: space[8] }}>
              Navigation
            </Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: colors.slate50 }}
              onPress={() => router.push('/offline')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
                <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Map size={15} color={colors.slate500} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: colors.slate900 }}>Offline Maps</Text>
                  <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>Saved route data and reports waiting to sync</Text>
                </View>
              </View>
              <ChevronRight size={16} color={colors.slate300} />
            </TouchableOpacity>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: colors.slate50 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
                <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Moon size={15} color={colors.slate500} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: colors.slate900 }}>Night / storm theme</Text>
                  <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>Low-glare navigation screen</Text>
                </View>
              </View>
              <Switch
                value={themeMode === 'storm'}
                onValueChange={toggleTheme}
                accessibilityLabel="Night or storm navigation theme"
              />
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: colors.slate50 }}
              onPress={() => router.push('/report-history')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
                <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <History size={15} color={colors.slate500} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: colors.slate900 }}>My Reports</Text>
                  <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>Past field reports and review status</Text>
                </View>
              </View>
              <ChevronRight size={16} color={colors.slate300} />
            </TouchableOpacity>
          </View>

          {/* Alerts */}
          <View style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase', paddingHorizontal: space[16], paddingTop: space[14], paddingBottom: space[8] }}>
              Alerts &amp; Sharing
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: colors.slate50 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10], flex: 1, paddingRight: space[12] }}>
                <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <BellRing size={15} color={colors.slate500} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: colors.slate900 }}>Hazard proximity alerts</Text>
                  <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>Warn me when a verified hazard is ahead</Text>
                </View>
              </View>
              <Switch
                value={prefs.hazardAlerts}
                onValueChange={(v) => void handlePrefChange('hazardAlerts', v)}
                accessibilityLabel="Hazard proximity alerts"
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: colors.slate50 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10], flex: 1, paddingRight: space[12] }}>
                <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Gauge size={15} color={colors.slate500} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: colors.slate900 }}>Share location telemetry</Text>
                  <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>Send speed and position while navigating</Text>
                </View>
              </View>
              <Switch
                value={prefs.telemetry}
                onValueChange={(v) => void handlePrefChange('telemetry', v)}
                accessibilityLabel="Share location telemetry"
              />
            </View>
          </View>

          {/* App */}
          <View style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase', paddingHorizontal: space[16], paddingTop: space[14], paddingBottom: space[8] }}>
              App
            </Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: colors.slate50 }}
              onPress={() => void Linking.openURL('mailto:support@metroflow.lgu?subject=MetroFlow%20Driver%20App')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
                <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <HelpCircle size={15} color={colors.slate500} />
                </View>
                <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: colors.slate900 }}>Help &amp; Support</Text>
              </View>
              <ChevronRight size={16} color={colors.slate300} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[16], paddingVertical: space[12], borderTopWidth: 1, borderColor: colors.slate50, gap: space[10] }}>
              <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Info size={15} color={colors.slate500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>Version</Text>
                <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: colors.slate900 }}>
                  {Constants.expoConfig?.version ?? '—'}
                  {Constants.nativeBuildVersion ? ` (build ${Constants.nativeBuildVersion})` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Sign out */}
          <TouchableOpacity
            style={{ backgroundColor: colors.white, paddingVertical: space[14], borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[8], borderWidth: 1, borderColor: colors.red200 }}
            onPress={handleSignOut}
          >
            <LogOut size={16} color={colors.red600} />
            <Text style={{ color: colors.red600, fontWeight: '700', fontSize: fontSize.label }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
