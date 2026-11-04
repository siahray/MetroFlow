import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Map, HardDrive, Info } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { cacheStats, formatBytes, type CacheStats } from '../offline';
import { colors } from '../theme';

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, color: colors.slate600 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: ok ? colors.green700 : colors.slate400 }}>
        {value}
      </Text>
    </View>
  );
}

export default function OfflineMapsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<CacheStats | null>(null);

  // Read once per visit: the cache fills as the driver navigates, and the screen
  // is opened from the profile, so entering it is the natural refresh point.
  useEffect(() => {
    void cacheStats().then(setStats);
  }, []);

  const saved = stats !== null && (stats.network || stats.hasRoute);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.slate100 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50, borderRadius: 10, borderWidth: 1, borderColor: colors.slate200 }}>
          <ArrowLeft size={18} color={colors.slate800} />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.slate900 }}>Offline Data</Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 72, height: 72, backgroundColor: colors.slate100, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Map size={34} color={colors.slate400} />
        </View>

        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.slate900 }}>
            {saved ? 'Saved for offline use' : 'Nothing saved yet'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.slate500, textAlign: 'center', lineHeight: 20 }}>
            The road graph, active hazards and your last route are saved on this device and used
            when the network is unavailable. Plan one route while online to fill the cache.
          </Text>
        </View>

        {/* Storage card: what is really in the local cache (FSD-FR-070). */}
        <View style={{ width: '100%', backgroundColor: colors.slate50, borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.slate200 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HardDrive size={16} color={colors.slate600} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.slate700 }}>On this device</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.slate500 }}>{formatBytes(stats?.bytes ?? 0)}</Text>
          </View>

          <StatusRow
            label="Road graph"
            value={stats?.network ? 'Saved' : 'Not saved'}
            ok={stats?.network ?? false}
          />
          <StatusRow
            label="Active hazards"
            value={stats === null ? '—' : String(stats.hazards)}
            ok={(stats?.hazards ?? 0) > 0}
          />
          <StatusRow
            label="Last route"
            value={stats?.hasRoute ? 'Saved' : 'Not saved'}
            ok={stats?.hasRoute ?? false}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f0f9ff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd', width: '100%' }}>
          <Info size={15} color={colors.sky600} />
          <Text style={{ fontSize: 11, color: '#0369a1', flex: 1, lineHeight: 16 }}>
            Basemap tiles are not downloaded in this pilot, so the map background needs a
            connection. The graph, hazards and route above do not.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
