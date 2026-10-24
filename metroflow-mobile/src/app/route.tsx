import { View, Text, TouchableOpacity, TextInput, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Navigation, Clock, Route, X } from 'lucide-react-native';

export default function RouteScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-slate-100">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-slate-900">Set Destination</Text>
      </View>
      <ScrollView className="flex-1 px-4 py-4">
        <View className="bg-slate-50 rounded-2xl p-4 mb-4">
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-2 h-2 rounded-full bg-emerald-500" />
            <TextInput className="flex-1 text-sm text-slate-700" value="Current Location (GPS)" editable={false} />
          </View>
          <View className="w-0.5 h-4 bg-slate-300 ml-1 mb-3" />
          <View className="flex-row items-center gap-3">
            <MapPin size={16} color="#2563eb" />
            <TextInput className="flex-1 text-sm" placeholder="Search destination or drop pin" />
          </View>
        </View>
        <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Recent</Text>
        <View className="space-y-2">
          {['Market Market, Taguig', 'Shaw Boulevard', 'Bagong Ilog'].map((loc, i) => (
            <TouchableOpacity key={i} className="flex-row items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl">
              <Clock size={16} color="#94a3b8" />
              <Text className="text-sm text-slate-700">{loc}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View className="mt-6 bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <View className="p-4">
            <Text className="text-sm font-bold text-slate-900 mb-1">Recommended: Flood-Safe Route</Text>
            <Text className="text-xs text-slate-500">Avoids all verified hazards</Text>
            <View className="flex-row items-center gap-4 mt-2">
              <View className="flex-row items-center gap-1">
                <Route size={14} color="#64748b" />
                <Text className="text-xs text-slate-600">5.2 km</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Clock size={14} color="#64748b" />
                <Text className="text-xs text-slate-600">~14 min</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity className="bg-slate-900 py-3 items-center" onPress={() => router.replace('/home')}>
            <Text className="text-white font-bold text-sm">Start Navigation</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
