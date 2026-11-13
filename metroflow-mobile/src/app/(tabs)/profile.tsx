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
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
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
  Phone,
  Volume2,
  X,
} from 'lucide-react-native';
import { ApiError, updateMyName, updateMyMobile } from '../../api';
import { useAuth } from '../../auth';
import { initialsOf } from '../../components/Avatar';
import { QuickPicks } from '../../components/QuickPicks';
import { useDialog } from '../../components/Dialog';
import { VehicleGarage } from '../../components/VehicleGarage';
import { loadMyVehicle, type MyVehicle } from '../../myVehicle';
import { savePrefs, usePrefs, type DriverPrefs } from '../../prefs';

import { fontSize, space, useTheme, type ThemeColors } from '../../theme';

type IconComponent = ComponentType<{ size?: number; color?: string }>;

/** The row hairline that separates one setting from the next. */
function rowStyle(c: ThemeColors) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[12],
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    borderTopWidth: 1,
    borderColor: c.slate100,
  };
}

/** One settings row: icon tile, title/subtitle, then a chevron or the caller's control. */
function Row({
  c,
  icon: Icon,
  title,
  subtitle,
  onPress,
  right,
  a11yLabel,
}: {
  c: ThemeColors;
  icon: IconComponent;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  /** Read instead of the title when the title is a value, not a name (a phone number, a version). */
  a11yLabel?: string;
}) {
  const body = (
    <>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: c.blue50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} color={c.blue600} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: fontSize.label, fontWeight: '600', color: c.slate900 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={{ fontSize: fontSize.micro, color: c.slate400, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={16} color={c.slate300} /> : null)}
    </>
  );

  if (!onPress) return <View style={rowStyle(c)}>{body}</View>;
  return (
    <TouchableOpacity
      style={rowStyle(c)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? title}
    >
      {body}
    </TouchableOpacity>
  );
}

/** A titled card of rows; the header hairline is the first row's top border. */
function Section({ c, title, children }: { c: ThemeColors; title: string; children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: c.white,
        borderRadius: 18,
        shadowColor: c.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <Text
        style={{
          fontSize: fontSize.micro,
          fontWeight: '800',
          color: c.slate400,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          paddingHorizontal: space[16],
          paddingTop: space[14],
          paddingBottom: space[10],
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

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
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState(user?.mobile_number ?? '');
  const [savingPhone, setSavingPhone] = useState(false);

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

  async function handleSavePhone() {
    if (!user) return;
    const trimmed = phoneDraft.trim();
    // Checked here so the API's 422 body never reaches the driver as raw JSON.
    const digits = trimmed.replace(/\D/g, '');
    if (trimmed && (digits.length < 7 || digits.length > 15)) {
      await notice({
        title: 'Check that number',
        message: 'Enter a mobile number dispatch can call, for example +63 917 555 0100.',
        tone: 'warning',
      });
      return;
    }
    setSavingPhone(true);
    try {
      signIn(await updateMyMobile(trimmed || null));
      setEditingPhone(false);
    } catch (error) {
      await notice({
        title: 'Could not save',
        message:
          error instanceof ApiError && error.status < 500
            ? error.message
            : 'Check your connection and try again.',
        tone: 'danger',
      });
    } finally {
      setSavingPhone(false);
    }
  }

  const displayName = user?.name || 'Public Driver';
  const roleLabel = (user?.role && user.role !== 'PUBLIC_DRIVER' ? user.role : 'Driver').replace(/_/g, ' ');

  const stats: { label: string; value: string; icon: IconComponent }[] = [
    { label: 'Clearance', value: `${vehicle?.clearanceCm ?? 28} cm`, icon: Gauge },
    { label: 'Account', value: user ? 'Signed in' : 'Guest', icon: ShieldCheck },
  ];

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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.white }}>
      <StatusBar barStyle={themeMode === 'storm' ? 'light-content' : 'dark-content'} />

      <View
        style={{
          paddingHorizontal: space[20],
          paddingVertical: space[12],
          borderBottomWidth: 1,
          borderColor: c.slate100,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.white,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: c.blue100,
            backgroundColor: c.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Waves size={22} color={c.blue600} />
        </View>
        <View style={{ marginLeft: space[10] }}>
          <Text style={{ fontSize: fontSize.caption, fontWeight: '800', color: c.blue600, letterSpacing: 0.8 }}>
            METROFLOW
          </Text>
          <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: c.slate900 }}>Profile</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: c.slate50 }}
        contentContainerStyle={{ padding: space[20], gap: space[16], paddingBottom: space[28] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity: the one dark card on the screen, same treatment as Home's route card */}
        <View style={{ backgroundColor: c.inkBg, borderRadius: 20, padding: space[20], gap: space[16] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[14] }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                borderWidth: 2,
                borderColor: c.blue300,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.jumbo, fontWeight: '800', color: c.onInk }}>
                {initialsOf(displayName)}
              </Text>
            </View>

            <View style={{ flex: 1, gap: space[6] }}>
              {editingName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    autoFocus
                    editable={!savingName}
                    accessibilityLabel="Display name"
                    style={{
                      flex: 1,
                      fontSize: fontSize.title,
                      fontWeight: '800',
                      color: c.onInk,
                      borderBottomWidth: 1,
                      borderColor: c.inkMuted,
                      paddingVertical: space[2],
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => void handleSaveName()}
                    disabled={savingName}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Save display name"
                  >
                    <Check size={20} color={c.green400} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Edit display name"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[6] }}
                  onPress={() => {
                    if (!user) return;
                    setNameDraft(user.name);
                    setEditingName(true);
                  }}
                  disabled={!user}
                >
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: fontSize.title, fontWeight: '800', color: c.onInk }}>
                    {displayName}
                  </Text>
                  {user ? <Pencil size={13} color={c.inkMuted} /> : null}
                </TouchableOpacity>
              )}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: space[4],
                  borderWidth: 1,
                  borderColor: c.blue300,
                  borderRadius: 999,
                  paddingHorizontal: space[10],
                  paddingVertical: space[3],
                }}
              >
                <ShieldCheck size={12} color={c.onInk} />
                <Text style={{ fontSize: fontSize.micro, fontWeight: '800', color: c.onInk }}>{roleLabel}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: c.slate700, paddingTop: space[14] }}>
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: space[3],
                    borderLeftWidth: i > 0 ? 1 : 0,
                    borderColor: c.slate700,
                  }}
                >
                  <Icon size={15} color={c.inkMuted} />
                  <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: c.onInk }}>{stat.value}</Text>
                  <Text
                    style={{
                      fontSize: fontSize.tiny,
                      fontWeight: '700',
                      color: c.inkMuted,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                    }}
                  >
                    {stat.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Section c={c} title="Account & Vehicle">
          <Row c={c} icon={Mail} title={user?.email || '—'} subtitle="Account email" />

          {editingPhone ? (
            <View style={{ ...rowStyle(c), flexDirection: 'column', alignItems: 'stretch', gap: space[6] }}>
              <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>Mobile Number (for dispatch)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
                <TextInput
                  value={phoneDraft}
                  onChangeText={setPhoneDraft}
                  autoFocus
                  editable={!savingPhone}
                  keyboardType="phone-pad"
                  placeholder="+63 917 555 0100"
                  placeholderTextColor={c.slate400}
                  accessibilityLabel="Mobile number"
                  style={{
                    flex: 1,
                    fontSize: fontSize.label,
                    fontWeight: '600',
                    color: c.slate900,
                    borderBottomWidth: 1,
                    borderColor: c.slate300,
                    paddingVertical: space[4],
                  }}
                />
                <TouchableOpacity
                  onPress={() => void handleSavePhone()}
                  disabled={savingPhone}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Save mobile number"
                >
                  <Check size={20} color={c.green600} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditingPhone(false)}
                  disabled={savingPhone}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel mobile number edit"
                >
                  <X size={18} color={c.slate400} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Row
              c={c}
              icon={Phone}
              title={user?.mobile_number || 'Not set'}
              subtitle="Call-back number dispatch uses on an active SOS"
              a11yLabel="Edit mobile number"
              onPress={() => {
                if (!user) return;
                setPhoneDraft(user.mobile_number ?? '');
                setEditingPhone(true);
              }}
              right={user ? <Pencil size={13} color={c.slate400} /> : undefined}
            />
          )}

          <View
            style={{
              paddingHorizontal: space[16],
              paddingVertical: space[12],
              borderTopWidth: 1,
              borderColor: c.slate100,
              gap: space[10],
            }}
          >
            <Text style={{ fontSize: fontSize.micro, color: c.slate400 }}>My garage (for flood-aware routing)</Text>
            <VehicleGarage onActiveChange={refreshActiveVehicle} />
          </View>
        </Section>

        <Section c={c} title="Navigation">
          <Row
            c={c}
            icon={Map}
            title="Offline Maps"
            subtitle="Saved route data and reports waiting to sync"
            onPress={() => router.push('/offline')}
          />
          <Row
            c={c}
            icon={MapPin}
            title="Quick Picks"
            subtitle="Saved destinations for faster safe routes"
            onPress={() => setShowQuickPicks(true)}
          />
        </Section>

        <Section c={c} title="Alerts & Sharing">
          <Row
            c={c}
            icon={BellRing}
            title="Hazard Proximity Alerts"
            subtitle="Warn me when a verified hazard is ahead"
            right={
              <Switch
                value={prefs.hazardAlerts}
                onValueChange={(v) => void handlePrefChange('hazardAlerts', v)}
                accessibilityLabel="Hazard proximity alerts"
              />
            }
          />
          <Row
            c={c}
            icon={Volume2}
            title="Voice Guidance"
            subtitle="Speak turn-by-turn directions and alerts aloud"
            right={
              <Switch
                value={prefs.voiceGuidance}
                onValueChange={(v) => void handlePrefChange('voiceGuidance', v)}
                accessibilityLabel="Voice guidance"
              />
            }
          />
          <Row
            c={c}
            icon={Gauge}
            title="Share Location Telemetry"
            subtitle="Send speed and position while navigating"
            right={
              <Switch
                value={prefs.telemetry}
                onValueChange={(v) => void handlePrefChange('telemetry', v)}
                accessibilityLabel="Share location telemetry"
              />
            }
          />
          <Row
            c={c}
            icon={History}
            title="My Reports"
            subtitle="Past field reports and review status"
            onPress={() => router.push('/report-history')}
          />
        </Section>

        <Section c={c} title="App">
          <Row
            c={c}
            icon={Clock}
            title="Theme By Time Of Day"
            subtitle="Light by day, low-glare after dark"
            right={
              <Switch
                value={prefs.autoTheme}
                onValueChange={(v) => void handlePrefChange('autoTheme', v)}
                accessibilityLabel="Theme by time of day"
              />
            }
          />
          <Row
            c={c}
            icon={Moon}
            title="Night / Storm Theme"
            subtitle={prefs.autoTheme ? 'Currently set by the clock' : 'Low-glare navigation screen'}
            right={
              <Switch
                value={themeMode === 'storm'}
                onValueChange={toggleTheme}
                disabled={prefs.autoTheme}
                accessibilityLabel="Night or storm navigation theme"
              />
            }
          />
          <Row
            c={c}
            icon={HelpCircle}
            title="Help & Support"
            onPress={() =>
              void Linking.openURL('mailto:support@metroflow.lgu?subject=MetroFlow%20Driver%20App')
            }
          />
          <Row
            c={c}
            icon={Info}
            title={Constants.expoConfig?.version ?? '—'}
            subtitle={
              Constants.nativeBuildVersion ? `Build ${Constants.nativeBuildVersion}` : 'App version'
            }
            a11yLabel="App version"
          />
        </Section>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={handleSignOut}
          style={{
            backgroundColor: c.white,
            borderRadius: 18,
            paddingVertical: space[14],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[8],
            borderWidth: 1,
            borderColor: c.red200,
          }}
        >
          <LogOut size={16} color={c.red600} />
          <Text style={{ color: c.red600, fontWeight: '800', fontSize: fontSize.label }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <QuickPicks
        visible={showQuickPicks}
        onClose={() => setShowQuickPicks(false)}
        clearanceCm={vehicle?.clearanceCm ?? 28}
      />
    </SafeAreaView>
  );
}
