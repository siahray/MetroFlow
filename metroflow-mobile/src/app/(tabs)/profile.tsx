import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
  Alert,
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
  Info,
} from 'lucide-react-native';
import { updateMyName } from '../../api';
import { useAuth } from '../../auth';
import { loadMyVehicle, saveMyVehicle, type MyVehicle, type VehicleType } from '../../myVehicle';

import { colors } from '../../theme';

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
      <View style={{ paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.slate100 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.slate900 }}>Profile</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Avatar card */}
        <View style={{ backgroundColor: '#fff', padding: 24, alignItems: 'center', borderBottomWidth: 1, borderColor: colors.slate100 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.slate900, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{initials}</Text>
          </View>
          {editingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                autoFocus
                editable={!savingName}
                style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.slate900, borderBottomWidth: 1, borderColor: colors.slate300, textAlign: 'center', paddingVertical: 4 }}
              />
              <TouchableOpacity onPress={() => void handleSaveName()} disabled={savingName} hitSlop={8}>
                <Check size={20} color={colors.green600} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              onPress={() => {
                if (!user) return;
                setNameDraft(user.name);
                setEditingName(true);
              }}
              disabled={!user}
            >
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.slate900 }}>{displayName}</Text>
              {user ? <Pencil size={13} color={colors.slate400} /> : null}
            </TouchableOpacity>
          )}
          <Text style={{ fontSize: 12, color: colors.blue600, fontWeight: '600', marginTop: 4 }}>
            {user?.role && user.role !== 'EMERGENCY_DRIVER' ? user.role : 'Driver'}
          </Text>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', width: '100%', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderColor: colors.slate100, gap: 0 }}>
            {[
              { label: 'Clearance', value: `${vehicle?.clearanceCm ?? 28} cm`, icon: Gauge, color: colors.slate900 },
              { label: 'Account', value: user ? 'Signed in' : 'Guest', icon: ShieldCheck, color: user ? colors.green600 : colors.slate500 },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <View key={stat.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderColor: colors.slate100 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase', marginBottom: 4 }}>{stat.label}</Text>
                  <Icon size={14} color={stat.color} />
                  <Text style={{ fontSize: 14, fontWeight: '800', color: stat.color, marginTop: 4 }}>{stat.value}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          {/* Account details */}
          <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
              Account & Vehicle
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.slate50, gap: 10 }}>
              <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={15} color={colors.slate500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.slate400 }}>Account Email</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.slate900 }}>{user?.email || '—'}</Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.slate50, gap: 10 }}>
              <Text style={{ fontSize: 10, color: colors.slate400 }}>My vehicle (for flood-aware routing)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
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
                        gap: 4,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: selected ? colors.slate900 : colors.slate100,
                      }}
                    >
                      <Icon size={16} color={selected ? colors.white : colors.slate600} />
                      <Text style={{ fontSize: 9, fontWeight: '700', color: selected ? colors.white : colors.slate600 }}>
                        {VEHICLE_TYPE_LABEL[type]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {editingVehicle ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={clearanceDraft}
                    onChangeText={setClearanceDraft}
                    keyboardType="number-pad"
                    autoFocus
                    style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.slate900, borderWidth: 1, borderColor: colors.slate300, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                  />
                  <Text style={{ fontSize: 12, color: colors.slate500 }}>cm</Text>
                  <TouchableOpacity onPress={() => void handleSaveClearance()} hitSlop={8}>
                    <Check size={20} color={colors.green600} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Edit routing clearance"
                  onPress={handleEditClearance}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.slate900 }}>
                    Ground clearance: {vehicle?.clearanceCm ?? 28} cm
                  </Text>
                  <Pencil size={12} color={colors.slate400} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Settings */}
          <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
              Navigation
            </Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 1, borderColor: colors.slate50 }}
              onPress={() => router.push('/offline')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Map size={15} color={colors.slate500} />
                </View>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.slate900 }}>Offline Maps</Text>
                  <Text style={{ fontSize: 10, color: colors.slate400 }}>Saved route data and reports waiting to sync</Text>
                </View>
              </View>
              <ChevronRight size={16} color={colors.slate300} />
            </TouchableOpacity>
          </View>

          {/* App */}
          <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
              App
            </Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 1, borderColor: colors.slate50 }}
              onPress={() => void Linking.openURL('mailto:support@metroflow.lgu?subject=MetroFlow%20Driver%20App')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <HelpCircle size={15} color={colors.slate500} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.slate900 }}>Help &amp; Support</Text>
              </View>
              <ChevronRight size={16} color={colors.slate300} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.slate50, gap: 10 }}>
              <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Info size={15} color={colors.slate500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.slate400 }}>Version</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.slate900 }}>
                  {Constants.expoConfig?.version ?? '—'}
                  {Constants.nativeBuildVersion ? ` (build ${Constants.nativeBuildVersion})` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Sign out */}
          <TouchableOpacity
            style={{ backgroundColor: '#fff', paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#fecaca' }}
            onPress={handleSignOut}
          >
            <LogOut size={16} color={colors.red600} />
            <Text style={{ color: colors.red600, fontWeight: '700', fontSize: 13 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
