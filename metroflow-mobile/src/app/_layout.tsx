import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="home" />
        <Stack.Screen name="route" />
        <Stack.Screen name="report" />
        <Stack.Screen name="sos" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="offline" />
      </Stack>
    </SafeAreaProvider>
  );
}
