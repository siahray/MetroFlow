import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Car, Map, ChevronRight, LogOut, ShieldCheck, Gauge, AlertTriangle } from 'lucide-react-native';
import { useAuth } from '../../auth';

import { colors } from '../../theme';
export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.slate50 }}>
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
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.slate900 }}>{displayName}</Text>
          <Text style={{ fontSize: 12, color: colors.blue600, fontWeight: '600', marginTop: 4 }}>
            {user?.role && user.role !== 'EMERGENCY_DRIVER' ? user.role : 'Public Motorist / Commuter'}
          </Text>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', width: '100%', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderColor: colors.slate100, gap: 0 }}>
            {[
              { label: 'Clearance', value: '28 cm', icon: Gauge, color: colors.slate900 },
              { label: 'Alert Sync', value: 'Active',  icon: ShieldCheck, color: colors.green600 },
              { label: 'Reports',   value: '0',       icon: AlertTriangle, color: colors.slate900 },
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
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.slate50, gap: 10 }}>
              <View style={{ width: 32, height: 32, backgroundColor: colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Car size={15} color={colors.slate500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.slate400 }}>Registered Vehicle</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.slate900 }}>Personal Vehicle (SUV / Sedan)</Text>
              </View>
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
                  <Text style={{ fontSize: 10, color: colors.slate400 }}>Visual placeholder — out of pilot scope</Text>
                </View>
              </View>
              <ChevronRight size={16} color={colors.slate300} />
            </TouchableOpacity>
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
