import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Waves, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../auth';
import { BackButton } from '../components/BackButton';
import { PasswordField } from '../components/PasswordField';
import { login as apiLogin, register as apiRegister } from '../api';

import { fontSize, space, useTheme } from '../theme';
type Mode = 'splash' | 'login' | 'register';

export default function IndexScreen() {
  const router = useRouter();
  const { signIn, user, ready } = useAuth();
  const { c, mode: themeMode } = useTheme();

  const [mode, setMode] = useState<Mode>('splash');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function goToApp() {
    router.replace('/(tabs)/home');
  }

  // A saved session goes straight to the app; the login screen is only for a
  // driver who has signed out or never signed in.
  useEffect(() => {
    if (ready && user) router.replace('/(tabs)/home');
  }, [ready, user, router]);

  async function handleLogin() {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const user = await apiLogin(email, password);
      signIn(user);
      goToApp();
    } catch {
      setError('Invalid credentials. Check email and password.');
      setSubmitting(false);
    }
  }

  async function handleRegister() {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (!name.trim()) throw new Error('Full name is required.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');
      const user = await apiRegister({ name, email, password, role: 'DRIVER' });
      signIn(user);
      goToApp();
    } catch (e: any) {
      setError(e.message || 'Registration failed.');
      setSubmitting(false);
    }
  }

  /* ── SPLASH ── */
  if (mode === 'splash') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.slate50 }}>
        <StatusBar barStyle={themeMode === 'storm' ? 'light-content' : 'dark-content'} />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: space[24], justifyContent: 'space-between' }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space[8] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.blue100, paddingHorizontal: space[12], paddingVertical: space[4], borderRadius: 999 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.blue600, marginRight: space[6] }} />
              <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: c.blue700 }}>Live Flood Network</Text>
            </View>
            <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: c.slate500, textTransform: 'uppercase' }}>Civic Transit Safe</Text>
          </View>

          {/* Hero */}
          <View style={{ alignItems: 'center', paddingVertical: space[32] }}>
            <View style={{ width: 80, height: 80, backgroundColor: c.slate900, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: space[16] }}>
              <Waves size={40} color={c.sky400} />
            </View>
            <Text style={{ fontSize: fontSize.hero, fontWeight: '900', color: c.slate900, letterSpacing: -0.5 }}>MetroFlow</Text>
            <Text style={{ fontSize: fontSize.label, color: c.slate500, marginTop: space[4] }}>Safer Roads. Stronger Communities.</Text>

            <View style={{ backgroundColor: c.white, padding: space[14], borderRadius: 16, borderWidth: 1, borderColor: c.slate200, marginTop: space[24], maxWidth: 300, width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
                <ShieldCheck size={16} color={c.cyan600} />
                <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: c.slate800 }}>Real-Time Hydrologic Rerouting</Text>
              </View>
              <Text style={{ fontSize: fontSize.micro, color: c.slate500, marginTop: space[6], lineHeight: 15 }}>
                Calculates safe corridors based on your vehicle&apos;s ground clearance. Flood data is live-synced from the MDRRMC emergency network.
              </Text>
            </View>
          </View>

          {/* CTA */}
          <View style={{ gap: space[12], marginBottom: space[16] }}>
            <TouchableOpacity
              style={{ backgroundColor: c.slate900, paddingVertical: space[15], borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space[8] }}
              onPress={() => setMode('login')}
            >
              <Text style={{ color: c.white, fontWeight: '700', fontSize: fontSize.lead }}>Sign In</Text>
              <ArrowRight size={16} color={c.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: c.blue50, paddingVertical: space[15], borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: c.blue200 }}
              onPress={() => setMode('register')}
            >
              <Text style={{ color: c.blue900, fontWeight: '700', fontSize: fontSize.lead }}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: space[10] }} onPress={goToApp}>
              <Text style={{ fontSize: fontSize.body, color: c.slate400 }}>Continue as Guest</Text>
            </TouchableOpacity>
            <Text style={{ textAlign: 'center', fontSize: fontSize.micro, color: c.slate300 }}>
              By continuing, you agree to the Safe Transit Guidelines.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── LOGIN / REGISTER ── */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.slate50 }}>
      <StatusBar barStyle={themeMode === 'storm' ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
<ScrollView contentContainerStyle={{ flexGrow: 1, padding: space[24] }} keyboardShouldPersistTaps="handled">
        <View style={{ alignSelf: 'flex-start', marginTop: space[8], marginBottom: space[32] }}>
          <BackButton onPress={() => { setMode('splash'); setError(''); }} />
        </View>

        <View style={{ alignItems: 'center', marginBottom: space[32] }}>
          <View style={{ width: 64, height: 64, backgroundColor: c.slate900, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: space[12] }}>
            <Waves size={30} color={c.sky400} />
          </View>
          <Text style={{ fontSize: fontSize.display, fontWeight: '900', color: c.slate900 }}>
            MetroFlow {mode === 'login' ? 'Sign In' : 'Sign Up'}
          </Text>
          <Text style={{ fontSize: fontSize.body, color: c.slate500, marginTop: space[4] }}>
            {mode === 'login' ? 'Sign in to access real-time flood navigation' : 'Create your public motorist account'}
          </Text>
        </View>

        <View style={{ gap: space[14] }}>
          {mode === 'register' && (
            <View>
              <Text style={{ fontSize: fontSize.caption, fontWeight: '600', color: c.slate700, marginBottom: space[6] }}>Full Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={{ backgroundColor: c.white, borderWidth: 1, borderColor: c.slate200, borderRadius: 12, paddingHorizontal: space[14], paddingVertical: space[12], fontSize: fontSize.label, color: c.slate900 }}
                placeholder="Juan Dela Cruz"
              />
            </View>
          )}
          <View>
            <Text style={{ fontSize: fontSize.caption, fontWeight: '600', color: c.slate700, marginBottom: space[6] }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ backgroundColor: c.white, borderWidth: 1, borderColor: c.slate200, borderRadius: 12, paddingHorizontal: space[14], paddingVertical: space[12], fontSize: fontSize.label, color: c.slate900 }}
              placeholder="you@example.com"
            />
          </View>
          <PasswordField
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoComplete={mode === 'register' ? 'new-password' : 'password'}
          />
          {mode === 'register' && (
            <PasswordField
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoComplete="new-password"
            />
          )}

          {error ? (
            <Text style={{ fontSize: fontSize.body, color: c.red600, textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={{ backgroundColor: c.slate900, paddingVertical: space[15], borderRadius: 14, alignItems: 'center', marginTop: space[4] }}
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color={c.white} />
              : <Text style={{ color: c.white, fontWeight: '700', fontSize: fontSize.lead }}>
                  {mode === 'login' ? 'Sign In' : 'Sign Up'}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: space[10] }} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setConfirmPassword(''); }}>
            <Text style={{ fontSize: fontSize.label, color: c.slate600 }}>
              {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: space[6] }} onPress={goToApp}>
            <Text style={{ fontSize: fontSize.body, color: c.slate400 }}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
</KeyboardAvoidingView>
    </SafeAreaView>
  );
}
