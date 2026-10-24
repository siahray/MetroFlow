import { View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, LifeBuoy, MapPin, AlertOctagon } from 'lucide-react-native';

export default function SOSScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-red-50">
      <StatusBar barStyle="dark-content" />
      <View className="flex-row items-center gap-3 px-4 py-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={20} color="#991b1b" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-red-900">Emergency SOS</Text>
      </View>
      <View className="flex-1 px-4 items-center justify-center">
        <View className="w-32 h-32 bg-red-600 rounded-full items-center justify-center mb-6 shadow-xl" style={{ shadowColor: '#dc2626', shadowOpacity: 0.4, shadowRadius: 40 }}>
          <LifeBuoy size={56} color="#ffffff" />
        </View>
        <Text className="text-xl font-black text-red-900 mb-2">SEND DISTRESS SIGNAL</Text>
        <Text className="text-sm text-red-700 text-center mb-6 px-6">This will drop a pin at your current location on the admin dispatch map.</Text>
        <View className="flex-row items-center gap-2 bg-white/80 px-4 py-2 rounded-full mb-8">
          <MapPin size={14} color="#dc2626" />
          <Text className="text-xs text-red-800">Location fix required (fresh)</Text>
        </View>
        <TouchableOpacity className="w-full bg-red-600 py-4 rounded-2xl mb-3" onPress={() => router.replace('/home')}>
          <Text className="text-white font-bold text-base text-center">CONFIRM SOS</Text>
        </TouchableOpacity>
        <TouchableOpacity className="w-full bg-white py-3 rounded-2xl border border-red-200" onPress={() => router.back()}>
          <Text className="text-red-700 font-bold text-sm text-center">Cancel</Text>
        </TouchableOpacity>
      </View>
      <View className="px-4 pb-4">
        <Text className="text-center text-[10px] text-red-600">Native telephony disabled in this prototype.</Text>
      </View>
    </SafeAreaView>
  );
}
