import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  Mail,
  Map,
  MapPin,
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
  Clock,
  Waves,
} from 'lucide-react-native';
import { updateMyName } from '../../api';
import { useAuth } from '../../auth';
import { QuickPicks } from '../../components/QuickPicks';
import { useDialog } from '../../components/Dialog';
import { VehicleGarage } from '../../components/VehicleGarage';
import { loadMyVehicle, type MyVehicle } from '../../myVehicle';
import { savePrefs, usePrefs, type DriverPrefs } from '../../prefs';

import { fontSize, space, useTheme } from '../../theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signIn, signOut } = useAuth();
  const { confirm, notice } = useDialog();
  const { c, mode: themeMode, toggle: toggleTheme } = useTheme();
  const prefs = usePrefs();

  async function handlePrefChange(key: keyof DriverPrefs, value: boolean) {
    await savePrefs({ ...prefs, [key]: value });
  }
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [vehicle, setVehicle] = useState<MyVehicle | null>(null);
  const [showQuickPicks, setShowQuickPicks] = useState(false);

  const refreshActiveVehicle = () => void loadMyVehicle().then(setVehicle);

  useEffect(() => {
    refreshActiveVehicle();
  }, []);

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
      await notice({
        title: 'Could not save',
        message: 'Check your connection and try again.',
        tone: 'danger',
      });
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

  async function handleSignOut() {
    const confirmed = await confirm({
      title: 'Sign out?',
      message:
        'Saved quick picks and offline data stay on this phone; you will need your password to sign back in.',
      confirmLabel: 'Sign Out',
      destructive: true,
    });
    if (!confirmed) return;
    signOut();
    router.replace('/');
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.slate50 }}>
      <StatusBar barStyle={themeMode === 'storm' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={{ paddingHorizontal: space[16], paddingVertical: space[14], backgroundColor: c.white, borderBottomWidth: 1, borderColor: c.slate100 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.blue100, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center' }}>
            <Waves size={18} color={c.blue600} />
          </View>
          <View>
            <Text style={{ fontSize: fontSize.tiny, fontWeight: '800', color: c.blue600, textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 12 }}>
              METROFLOW
            </Text>
            <Text style={{ fontSize: fontSize.heading, fontWeight: '800', color: c.slate900, lineHeight: 20 }}>
              Profile
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Avatar card */}
        <View style={{ backgroundColor: c.white, padding: space[24], alignItems: 'center', borderBottomWidth: 1, borderColor: c.slate100 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.slate900, alignItems: 'center', justifyContent: 'center', marginBottom: space[12] }}>
            <Text style={{ color: c.white, fontSize: fontSize.hero, fontWeight: '800' }}>{initials}</Text>
          </View>
          {editingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8], width: '100%' }}>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                autoFocus
                editable={!savingName}
                style={{ flex: 1, fontSize: fontSize.heading, fontWeight: '700', color: c.slate900, borderBottomWidth: 1, borderColor: c.slate300, textAlign: 'center', paddingVertical: space[4] }}
              />
              <TouchableOpacity onPress={() => void handleSaveName()} disabled={savingName} hitSlop={8}>
                <Check size={20} color={c.green600} />
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
              <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: c.slate900 }}>{displayName}</Text>
              {user ? <Pencil size={13} color={c.slate400} /> : null}
            </TouchableOpacity>
          )}
          <Text style={{ fontSize: fontSize.body, color: c.blue600, fontWeight: '600', marginTop: space[4] }}>
            {user?.role && user.role !== 'EMERGENCY_DRIVER' ? user.role : 'Driver'}
          </Text>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', width: '100%', marginTop: space[20], paddingTop: space[16], borderTopWidth: 1, borderColor: c.slate100, gap: space[0] }}>
            {[
              { label: 'Clearance', value: `${vehicle?.clearanceCm ?? 28} cm`, icon: Gauge, color: c.slate900 },
              { label: 'Account', value: user ? 'Signed in' : 'Guest', icon: ShieldCheck, color: user ? c.green600 : c.slate500 },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <View key={stat.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderColor: c.slate100 }}>
                  <Text style={{ fontSize: fontSize.tiny, fontWeight: '700', color: c.slate400, textTransform: 'uppercase', marginBottom: space[4] }}>{stat.label}</Text>
                  <Icon size={14} color={stat.color} />
                  <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: stat.color, marginTop: space[4] }}>{stat.value}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ padding: space[16], gap: space[16] }}>
          {/* Account details */}
          <View style={{ backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: c.slate400, textTransform: 'uppercase', paddingHorizontal: space[16], paddingTop: space[14], paddingBottom: space[8] }}>
              Account & Vehicle
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[16], paddingVertical: space[12], borderTopWidth: 1, borderColor: c.slate50, gap: space[10] }}>
              <View style={{ width: 32, height: 32, backgroundColor: c.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={15} color={c.slate500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>Account Email</Text>
                <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>{user?.email || '—'}</Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: space[16], paddingVertical: space[12], borderTopWidth: 1, borderColor: c.slate50, gap: space[10] }}>
              <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>My garage (for flood-aware routing)</Text>
              <VehicleGarage onActiveChange={refreshActiveVehicle} />
            </View>
          </View>

          {/* Settings */}
          <View style={{ backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: c.slate400, textTransform: 'uppercase', paddingHorizontal: space[16], paddingTop: space[14], paddingBottom: space[8] }}>
              Navigation
            </Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: c.slate50 }}
              onPress={() => router.push('/offline')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
                <View style={{ width: 32, height: 32, backgroundColor: c.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Map size={15} color={c.slate500} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>Offline Maps</Text>
                  <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>Saved route data and reports waiting to sync</Text>
                </View>
              </View>
              <ChevronRight size={16} color={c.slate300} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Manage Quick Picks"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: c.slate50 }}
              onPress={() => setShowQuickPicks(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
                <View style={{ width: 32, height: 32, backgroundColor: c.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={15} color={c.slate500} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>Quick Picks</Text>
                  <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>Saved destinations for faster safe routes</Text>
                </View>
              </View>
              <ChevronRight size={16} color={c.slate300} />
            </TouchableOpacity>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: c.slate50 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
                <View style={{ width: 32, height: 32, backgroundColor: c.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={15} color={c.slate500} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>Theme By Time Of Day</Text>
                  <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>Light by day, low-glare after dark</Text>
                </View>
              </View>
              <Switch
                value={prefs.autoTheme}
                onValueChange={(v) => void handlePrefChange('autoTheme', v)}
                accessibilityLabel="Theme by time of day"
              />
            </View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: c.slate50 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
                <View style={{ width: 32, height: 32, backgroundColor: c.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Moon size={15} color={c.slate500} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>Night / Storm Theme</Text>
                  <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>
                    {prefs.autoTheme ? 'Currently set by the clock' : 'Low-glare navigation screen'}
                  </Text>
                </View>
              </View>
              <Switch
                value={themeMode === 'storm'}
                onValueChange={toggleTheme}
                disabled={prefs.autoTheme}
                accessibilityLabel="Night or storm navigation theme"
              />
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: c.slate50 }}
              onPress={() => router.push('/report-history')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
                <View style={{ width: 32, height: 32, backgroundColor: c.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <History size={15} color={c.slate500} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>My Reports</Text>
                  <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>Past field reports and review status</Text>
                </View>
              </View>
              <ChevronRight size={16} color={c.slate300} />
            </TouchableOpacity>
          </View>

          {/* Alerts */}
          <View style={{ backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: c.slate400, textTransform: 'uppercase', paddingHorizontal: space[16], paddingTop: space[14], paddingBottom: space[8] }}>
              Alerts &amp; Sharing
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: c.slate50 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10], flex: 1, paddingRight: space[12] }}>
                <View style={{ width: 32, height: 32, backgroundColor: c.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <BellRing size={15} color={c.slate500} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>Hazard Proximity Alerts</Text>
                  <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>Warn me when a verified hazard is ahead</Text>
                </View>
              </View>
              <Switch
                value={prefs.hazardAlerts}
                onValueChange={(v) => void handlePrefChange('hazardAlerts', v)}
                accessibilityLabel="Hazard proximity alerts"
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: c.slate50 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10], flex: 1, paddingRight: space[12] }}>
                <View style={{ width: 32, height: 32, backgroundColor: c.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Gauge size={15} color={c.slate500} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>Share Location Telemetry</Text>
                  <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>Send speed and position while navigating</Text>
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
          <View style={{ backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.slate200, overflow: 'hidden' }}>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: c.slate400, textTransform: 'uppercase', paddingHorizontal: space[16], paddingTop: space[14], paddingBottom: space[8] }}>
              App
            </Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[13], borderTopWidth: 1, borderColor: c.slate50 }}
              onPress={() => void Linking.openURL('mailto:support@metroflow.lgu?subject=MetroFlow%20Driver%20App')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
                <View style={{ width: 32, height: 32, backgroundColor: c.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <HelpCircle size={15} color={c.slate500} />
                </View>
                <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>Help &amp; Support</Text>
              </View>
              <ChevronRight size={16} color={c.slate300} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[16], paddingVertical: space[12], borderTopWidth: 1, borderColor: c.slate50, gap: space[10] }}>
              <View style={{ width: 32, height: 32, backgroundColor: c.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Info size={15} color={c.slate500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>Version</Text>
                <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>
                  {Constants.expoConfig?.version ?? '—'}
                  {Constants.nativeBuildVersion ? ` (build ${Constants.nativeBuildVersion})` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Sign out */}
          <TouchableOpacity
            style={{ backgroundColor: c.white, paddingVertical: space[14], borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[8], borderWidth: 1, borderColor: c.red200 }}
            onPress={handleSignOut}
          >
            <LogOut size={16} color={c.red600} />
            <Text style={{ color: c.red600, fontWeight: '700', fontSize: fontSize.label }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <QuickPicks
        visible={showQuickPicks}
        onClose={() => setShowQuickPicks(false)}
        clearanceCm={vehicle?.clearanceCm ?? 28}
      />
    </SafeAreaView>
  );
}
