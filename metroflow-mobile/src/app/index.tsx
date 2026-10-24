import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Waves, ArrowRight } from 'lucide-react-native';

export default function SplashScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <SafeAreaView className="flex-1 bg-slate-50" style={{ backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'space-between' }}>
        <View className="flex-row items-center justify-between pt-2">
          <View className="flex-row items-center gap-1.5 px-3 py-1 bg-blue-100/80 rounded-full">
            <View className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            <Text className="text-[10px] font-bold text-blue-700">Live Flood Network</Text>
          </View>
          <Text className="text-[10px] font-bold text-slate-500 uppercase">Civic Transit Safe</Text>
        </View>

        <View className="items-center space-y-4 py-8">
          <View className="w-20 h-20 bg-blue-600 rounded-3xl items-center justify-center shadow-xl" style={{ shadowColor: '#3b82f6', shadowOpacity: 0.2, shadowRadius: 20 }}>
            <Waves size={40} color="#ffffff" />
          </View>
          <View className="items-center">
            <Text className="text-2xl font-black text-slate-900 tracking-tight">MetroFlow</Text>
            <Text className="text-sm text-slate-500 mt-1">Flood-Aware Routing for Drivers</Text>
          </View>
        </View>

        <View className="space-y-3">
          <View>
            <Text className="text-xs font-semibold text-slate-600 mb-1.5">Email Address</Text>
            <TextInput
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm"
              placeholder="driver@metroflow.ph"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View>
            <Text className="text-xs font-semibold text-slate-600 mb-1.5">Password</Text>
            <TextInput
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
          <TouchableOpacity
            className="w-full py-3.5 bg-slate-900 rounded-xl flex-row items-center justify-center gap-2"
            onPress={() => router.replace('/home')}
          >
            <Text className="text-white font-bold text-sm">Log In</Text>
            <ArrowRight size={16} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            className="w-full py-3.5 bg-blue-50 rounded-xl"
            onPress={() => router.replace('/home')}
          >
            <Text className="text-blue-900 font-bold text-sm text-center">Continue as Guest</Text>
          </TouchableOpacity>
          <Text className="text-center text-[10px] text-slate-400 mt-2">By continuing, you agree to the Safe Transit Guidelines.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
