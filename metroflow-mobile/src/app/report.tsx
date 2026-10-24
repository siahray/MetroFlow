import { View, Text, TouchableOpacity, TextInput, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, MapPin, AlertTriangle } from 'lucide-react-native';

export default function ReportScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-slate-100">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-slate-900">Report Flood Hazard</Text>
      </View>
      <ScrollView className="flex-1 px-4 py-4">
        <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-row items-start gap-2 mb-4">
          <AlertTriangle size={16} color="#d97706" />
          <Text className="text-xs text-amber-800 flex-1">Reports help update flood-aware routing for the community.</Text>
        </View>
        <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Flood Depth</Text>
        <View className="flex-row gap-2 mb-4">
          {['Ankle-Deep', 'Knee-Deep', 'Impassable'].map((depth, i) => (
            <TouchableOpacity key={i} className={`flex-1 py-2.5 rounded-xl ${i === 2 ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'}`}>
              <Text className={`text-xs font-bold text-center ${i === 2 ? 'text-red-700' : 'text-slate-700'}`}>{depth}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Location</Text>
        <View className="flex-row items-center gap-2 p-3 bg-slate-50 rounded-xl mb-4">
          <MapPin size={16} color="#475569" />
          <Text className="text-xs text-slate-600 flex-1">Using current GPS location</Text>
        </View>
        <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Photo Evidence</Text>
        <TouchableOpacity className="border-2 border-dashed border-slate-200 rounded-xl p-6 items-center mb-4">
          <Camera size={24} color="#94a3b8" />
          <Text className="text-sm text-slate-600 mt-2">Take Photo or Attach Image</Text>
          <Text className="text-xs text-slate-400 mt-1">EXIF metadata will be recorded</Text>
        </TouchableOpacity>
        <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Notes (Optional)</Text>
        <TextInput className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm mb-6" placeholder="Additional details..." multiline numberOfLines={3} />
        <TouchableOpacity className="w-full bg-slate-900 py-3.5 rounded-xl mb-4" onPress={() => router.replace('/home')}>
          <Text className="text-white font-bold text-sm text-center">Submit Report</Text>
        </TouchableOpacity>
        <Text className="text-center text-[10px] text-slate-400">Reports are queued offline if no connection.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
