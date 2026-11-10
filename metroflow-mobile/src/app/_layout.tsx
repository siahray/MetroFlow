import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth';
import { DialogProvider } from '../components/Dialog';
import { ThemeProvider } from '../theme';

// Keep the native splash up until the session is known, then fade into the
// first real screen instead of a flash of signed-out content (P1-4).
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

function AppReady({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth();
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  return children;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <DialogProvider>
        <AuthProvider>
          <AppReady>
            <SafeAreaProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="route" />
                <Stack.Screen name="offline" />
                <Stack.Screen name="report-history" />
              </Stack>
            </SafeAreaProvider>
          </AppReady>
        </AuthProvider>
      </DialogProvider>
    </ThemeProvider>
  );
}
