import { View, Text, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Map, HardDrive, Info } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { BackButton } from '../components/BackButton';
import { cacheStats, formatBytes, type CacheStats } from '../offline';
import { fontSize, space, colors } from '../theme';

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: fontSize.body, color: colors.slate600 }}>{label}</Text>
      <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: ok ? colors.green700 : colors.slate400 }}>
        {value}
      </Text>
    </View>
  );
}

export default function OfflineMapsScreen() {
  const [stats, setStats] = useState<CacheStats | null>(null);

  // Read once per visit: the cache fills as the driver navigates, and the screen
  // is opened from the profile, so entering it is the natural refresh point.
  useEffect(() => {
    void cacheStats().then(setStats);
  }, []);

  const saved = stats !== null && (stats.network || stats.hasRoute);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <StatusBar barStyle="dark-content" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12], paddingHorizontal: space[16], paddingVertical: space[14], borderBottomWidth: 1, borderColor: colors.slate100 }}>
        <BackButton />
        <Text style={{ fontSize: fontSize.subtitle, fontWeight: '800', color: colors.slate900 }}>Offline Data</Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: space[24], justifyContent: 'center', alignItems: 'center', gap: space[16] }}>
        <View style={{ width: 72, height: 72, backgroundColor: colors.slate100, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Map size={34} color={colors.slate400} />
        </View>

        <View style={{ alignItems: 'center', gap: space[8] }}>
          <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: colors.slate900 }}>
            {saved ? 'Saved for Offline Use' : 'Nothing Saved Yet'}
          </Text>
          <Text style={{ fontSize: fontSize.label, color: colors.slate500, textAlign: 'center', lineHeight: 20 }}>
            The road graph, active hazards and your last route are saved on this device and used
            when the network is unavailable. Plan one route while online to fill the cache.
          </Text>
        </View>

        {/* Storage card: what is really in the local cache (FSD-FR-070). */}
        <View style={{ width: '100%', backgroundColor: colors.slate50, borderRadius: 14, padding: space[16], gap: space[10], borderWidth: 1, borderColor: colors.slate200 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
              <HardDrive size={16} color={colors.slate600} />
              <Text style={{ fontSize: fontSize.label, fontWeight: '600', color: colors.slate700 }}>On This Device</Text>
            </View>
            <Text style={{ fontSize: fontSize.body, color: colors.slate500 }}>{formatBytes(stats?.bytes ?? 0)}</Text>
          </View>

          <StatusRow
            label="Road Graph"
            value={stats?.network ? 'Saved' : 'Not saved'}
            ok={stats?.network ?? false}
          />
          <StatusRow
            label="Active Hazards"
            value={stats === null ? '—' : String(stats.hazards)}
            ok={(stats?.hazards ?? 0) > 0}
          />
          <StatusRow
            label="Last Route"
            value={stats?.hasRoute ? 'Saved' : 'Not saved'}
            ok={stats?.hasRoute ?? false}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[8], backgroundColor: colors.sky50, padding: space[14], borderRadius: 12, borderWidth: 1, borderColor: colors.sky200, width: '100%' }}>
          <Info size={15} color={colors.sky600} />
          <Text style={{ fontSize: fontSize.caption, color: colors.sky700, flex: 1, lineHeight: 16 }}>
            Basemap tiles are not downloaded in this pilot, so the map background needs a
            connection. The graph, hazards and route above do not.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
