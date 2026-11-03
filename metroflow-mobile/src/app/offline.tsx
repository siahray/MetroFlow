import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Map, Download, HardDrive, Info } from 'lucide-react-native';

import { colors } from '../theme';
export default function OfflineMapsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.slate100 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50, borderRadius: 10, borderWidth: 1, borderColor: colors.slate200 }}>
          <ArrowLeft size={18} color={colors.slate800} />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.slate900 }}>Offline Maps</Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 72, height: 72, backgroundColor: colors.slate100, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Map size={34} color={colors.slate400} />
        </View>

        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.slate900 }}>Offline Map Caching</Text>
          <Text style={{ fontSize: 13, color: colors.slate500, textAlign: 'center', lineHeight: 20 }}>
            Basemap tile downloads are out of scope for the pilot. The road graph, active hazards and your last route are saved automatically and shown when you are offline.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f0f9ff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd', width: '100%' }}>
          <Info size={15} color={colors.sky600} />
          <Text style={{ fontSize: 11, color: '#0369a1', flex: 1, lineHeight: 16 }}>
            When available, offline maps will cache hydrologic road-network tiles for use without connectivity. SQLite/tile download is planned for a future release.
          </Text>
        </View>

        {/* Storage card */}
        <View style={{ width: '100%', backgroundColor: colors.slate50, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.slate200 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HardDrive size={16} color={colors.slate600} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.slate700 }}>Cached Area</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.slate400 }}>None</Text>
          </View>
          <View style={{ height: 6, backgroundColor: colors.slate200, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: '0%', backgroundColor: colors.slate900 }} />
          </View>
          <Text style={{ fontSize: 10, color: colors.slate400, marginTop: 6 }}>0 MB used</Text>
        </View>

        <TouchableOpacity
          style={{ width: '100%', backgroundColor: colors.slate100, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          disabled
        >
          <Download size={16} color={colors.slate400} />
          <Text style={{ color: colors.slate400, fontWeight: '700', fontSize: 13 }}>Download Region (Disabled)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
