import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth';
import { AppSplash } from '../components/AppSplash';
import { DialogProvider } from '../components/Dialog';
import { SOSTrackerProvider } from '../sosTracker';
import { ThemeProvider } from '../theme';

// Keep the native splash up until the session is known, then fade into the
// first real screen instead of a flash of signed-out content (P1-4).
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

function AppReady({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync();
    // The native splash (300ms fade, see setOptions above) reveals this JS
    // splash underneath, not the first real screen directly -- swapping to
    // `children` the instant `ready` flips would mean the native image is
    // simply replaced by whatever the first screen renders mid-fade, rather
    // than one continuous splash moment. Held a beat past that fade so the
    // handoff reads as deliberate, not a stall.
    const timer = setTimeout(() => setShowSplash(false), 450);
    return () => clearTimeout(timer);
  }, [ready]);

  return showSplash ? <AppSplash /> : children;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <DialogProvider>
        <AuthProvider>
          <AppReady>
            <SafeAreaProvider>
              <SOSTrackerProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="route" />
                  <Stack.Screen name="offline" />
                  <Stack.Screen name="report-history" />
                </Stack>
              </SOSTrackerProvider>
            </SafeAreaProvider>
          </AppReady>
        </AuthProvider>
      </DialogProvider>
    </ThemeProvider>
  );
}
