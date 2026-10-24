import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Navigation, AlertTriangle, LifeBuoy, Menu, Locate, ShieldCheck, Clock } from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <StatusBar barStyle="light-content" />
      <View className="flex-1">
        {/* Map placeholder */}
        <View className="flex-1 bg-slate-800 items-center justify-center">
          <MapPin size={32} color="#94a3b8" />
          <Text className="text-slate-400 text-xs mt-2">MetroFlow Road Network Map</Text>
          <Text className="text-slate-500 text-[10px] mt-1">Flood-safe routing preview</Text>
        </View>

        {/* Top bar */}
        <View className="absolute top-0 left-0 right-0 px-4 pt-2">
          <View className="flex-row items-center gap-2 bg-white/95 rounded-2xl px-3 py-2 shadow-lg">
            <TouchableOpacity onPress={() => router.push('/profile')}>
              <Menu size={20} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 flex-row items-center gap-2" onPress={() => router.push('/route')}>
              <MapPin size={16} color="#2563eb" />
              <Text className="text-sm text-slate-600 flex-1">Where to?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/route')}>
              <Locate size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom sheet */}
        <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl px-4 pt-4 pb-6 shadow-2xl">
          <View className="w-10 h-1 bg-slate-200 rounded-full self-center mb-3" />
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-sm font-bold text-slate-900">Flood Status: Normal</Text>
              <Text className="text-xs text-slate-500">All major roads passable for most vehicles</Text>
            </View>
            <View className="flex-row items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full">
              <ShieldCheck size={12} color="#10b981" />
              <Text className="text-[10px] font-bold text-emerald-700">Safe</Text>
            </View>
          </View>
          <View className="flex-row gap-2 mb-3">
            <TouchableOpacity className="flex-1 bg-slate-900 py-3 rounded-xl flex-row items-center justify-center gap-2" onPress={() => router.push('/route')}>
              <Navigation size={16} color="#ffffff" />
              <Text className="text-white font-bold text-sm">Plan Route</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 bg-amber-50 py-3 rounded-xl flex-row items-center justify-center gap-2" onPress={() => router.push('/report')}>
              <AlertTriangle size={16} color="#d97706" />
              <Text className="text-amber-800 font-bold text-sm">Report Hazard</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity className="w-full bg-red-600 py-3 rounded-xl flex-row items-center justify-center gap-2" onPress={() => router.push('/sos')}>
            <LifeBuoy size={18} color="#ffffff" />
            <Text className="text-white font-bold text-sm">EMERGENCY SOS</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
