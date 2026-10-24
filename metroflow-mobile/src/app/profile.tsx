import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Car, Mail, LogOut, Map, ChevronRight } from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-slate-100">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-slate-900">Profile</Text>
      </View>
      <ScrollView className="flex-1">
        <View className="bg-white p-6 items-center border-b border-slate-100">
          <View className="w-20 h-20 bg-slate-800 rounded-full items-center justify-center mb-3">
            <Text className="text-white font-bold text-xl">DR</Text>
          </View>
          <Text className="text-base font-bold text-slate-900">Fleet Driver</Text>
          <Text className="text-xs text-blue-600 font-semibold mt-0.5">Driver / Fleet Member</Text>
          <View className="flex-row gap-6 mt-4 pt-4 border-t border-slate-100">
            <View className="items-center">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Clearance</Text>
              <Text className="text-sm font-bold text-slate-800">28 cm</Text>
            </View>
            <View className="items-center">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Alert Sync</Text>
              <Text className="text-sm font-bold text-emerald-600">Active</Text>
            </View>
            <View className="items-center">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Dispatches</Text>
              <Text className="text-sm font-bold text-slate-800">0</Text>
            </View>
          </View>
        </View>
        <View className="p-4 space-y-3">
          <View className="bg-white rounded-2xl p-4 border border-slate-100">
            <Text className="text-xs font-bold text-slate-400 uppercase mb-3">Account & Vehicle Details</Text>
            <View className="flex-row items-center justify-between py-2 border-b border-slate-50">
              <View className="flex-row items-center gap-2">
                <Mail size={16} color="#64748b" />
                <Text className="text-sm text-slate-600">Dispatch Email</Text>
              </View>
              <Text className="text-sm text-slate-900">driver@metroflow.ph</Text>
            </View>
            <View className="flex-row items-center justify-between py-2">
              <View className="flex-row items-center gap-2">
                <Car size={16} color="#64748b" />
                <Text className="text-sm text-slate-600">Vehicle</Text>
              </View>
              <Text className="text-sm text-slate-900">Emergency Unit</Text>
            </View>
          </View>
          <View className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <Text className="text-xs font-bold text-slate-400 uppercase px-4 pt-4 pb-2">Navigation</Text>
            <TouchableOpacity className="flex-row items-center justify-between px-4 py-3" onPress={() => router.push('/offline')}>
              <View className="flex-row items-center gap-2">
                <Map size={16} color="#64748b" />
                <Text className="text-sm text-slate-700">Offline Maps</Text>
              </View>
              <ChevronRight size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity className="w-full bg-white py-3 rounded-xl border border-red-100 flex-row items-center justify-center gap-2 mt-4" onPress={() => router.replace('/')}>
            <LogOut size={16} color="#dc2626" />
            <Text className="text-red-600 font-bold text-sm">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
