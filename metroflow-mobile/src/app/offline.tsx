import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Map, Download, HardDrive, Info } from 'lucide-react-native';

export default function OfflineMapsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <ArrowLeft size={18} color="#1e293b" />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>Offline Maps</Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 72, height: 72, backgroundColor: '#f1f5f9', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Map size={34} color="#94a3b8" />
        </View>

        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#0f172a' }}>Offline Map Caching</Text>
          <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 }}>
            This screen is a visual placeholder. Tile caching and map package downloads are out of scope for the current pilot.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f0f9ff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd', width: '100%' }}>
          <Info size={15} color="#0284c7" />
          <Text style={{ fontSize: 11, color: '#0369a1', flex: 1, lineHeight: 16 }}>
            When available, offline maps will cache hydrologic road-network tiles for use without connectivity. SQLite/tile download is planned for a future release.
          </Text>
        </View>

        {/* Storage card */}
        <View style={{ width: '100%', backgroundColor: '#f8fafc', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HardDrive size={16} color="#475569" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>Cached Area</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#94a3b8' }}>None</Text>
          </View>
          <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: '0%', backgroundColor: '#0f172a' }} />
          </View>
          <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>0 MB used</Text>
        </View>

        <TouchableOpacity
          style={{ width: '100%', backgroundColor: '#f1f5f9', paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          disabled
        >
          <Download size={16} color="#94a3b8" />
          <Text style={{ color: '#94a3b8', fontWeight: '700', fontSize: 13 }}>Download Region (Disabled)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
