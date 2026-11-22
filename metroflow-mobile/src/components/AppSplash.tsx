import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Waves } from 'lucide-react-native';

/**
 * JS splash shown while the first screen is still deciding where to go
 * (``AppReady`` in _layout.tsx, gated on the auth check). Same background
 * as app.json's native splash (#0f172a) and the same waves mark as
 * assets/splash-icon.png, so the native-to-JS handoff has no flash of a
 * different screen -- this just keeps that moment going a beat longer,
 * with a soft pulse instead of a static image.
 */
export function AppSplash() {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={styles.container}>
      <View style={styles.badgeWrap}>
        <Animated.View
          style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
        />
        <View style={styles.badge}>
          <Waves size={28} color="#ffffff" />
        </View>
      </View>
      <Text style={styles.wordmark}>MetroFlow</Text>
      <Text style={styles.tagline}>Flood-aware mobility</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  badgeWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  ring: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#60a5fa',
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(96,165,250,0.5)',
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { fontSize: 20, fontWeight: '800', color: '#ffffff', letterSpacing: 0.3 },
  tagline: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
});
