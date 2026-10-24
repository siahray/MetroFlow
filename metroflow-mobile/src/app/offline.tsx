import { View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Map, Download, HardDrive } from 'lucide-react-native';

export default function OfflineMapsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-slate-100">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-slate-900">Offline Maps</Text>
      </View>
      <View className="flex-1 px-4 items-center justify-center">
        <View className="w-16 h-16 bg-slate-100 rounded-2xl items-center justify-center mb-4">
          <Map size={32} color="#64748b" />
        </View>
        <Text className="text-base font-bold text-slate-900 mb-2">Offline Map Caching</Text>
        <Text className="text-sm text-slate-500 text-center mb-6 px-6">This screen is a visual placeholder. Tile caching and map package downloads are out of scope for this pilot.</Text>
        <View className="w-full bg-slate-50 rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <HardDrive size={16} color="#475569" />
              <Text className="text-sm text-slate-700">Cached Area</Text>
            </View>
            <Text className="text-xs text-slate-400">None</Text>
          </View>
          <View className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <View className="h-full w-0 bg-slate-400" />
          </View>
        </View>
        <TouchableOpacity className="w-full bg-slate-200 py-3 rounded-xl flex-row items-center justify-center gap-2" disabled>
          <Download size={16} color="#64748b" />
          <Text className="text-slate-500 font-bold text-sm">Download Region (Disabled)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
