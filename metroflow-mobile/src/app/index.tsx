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
import { PasswordField } from '../components/PasswordField';
import { login as apiLogin, register as apiRegister } from '../api';

import { colors } from '../theme';
type Mode = 'splash' | 'login' | 'register';

export default function IndexScreen() {
  const router = useRouter();
  const { signIn, user, ready } = useAuth();

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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.slate50 }}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'space-between' }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(219,234,254,0.8)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blue600, marginRight: 6 }} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.blue700 }}>Live Flood Network</Text>
            </View>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.slate500, textTransform: 'uppercase' }}>Civic Transit Safe</Text>
          </View>

          {/* Hero */}
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <View style={{ width: 80, height: 80, backgroundColor: colors.slate900, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Waves size={40} color="#38bdf8" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '900', color: colors.slate900, letterSpacing: -0.5 }}>MetroFlow</Text>
            <Text style={{ fontSize: 13, color: colors.slate500, marginTop: 4 }}>Safer Roads. Stronger Communities.</Text>

            <View style={{ backgroundColor: '#fff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.slate200, marginTop: 24, maxWidth: 300, width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} color="#0891b2" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.slate800 }}>Real-Time Hydrologic Rerouting</Text>
              </View>
              <Text style={{ fontSize: 10, color: colors.slate500, marginTop: 6, lineHeight: 15 }}>
                Calculates safe corridors based on your vehicle&apos;s ground clearance. Flood data is live-synced from the MDRRMC emergency network.
              </Text>
            </View>
          </View>

          {/* CTA */}
          <View style={{ gap: 12, marginBottom: 16 }}>
            <TouchableOpacity
              style={{ backgroundColor: colors.slate900, paddingVertical: 15, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
              onPress={() => setMode('login')}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Log In</Text>
              <ArrowRight size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: colors.blue50, paddingVertical: 15, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' }}
              onPress={() => setMode('register')}
            >
              <Text style={{ color: '#1e3a8a', fontWeight: '700', fontSize: 14 }}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={goToApp}>
              <Text style={{ fontSize: 12, color: colors.slate400 }}>Continue as Guest</Text>
            </TouchableOpacity>
            <Text style={{ textAlign: 'center', fontSize: 10, color: colors.slate300 }}>
              By continuing, you agree to the Safe Transit Guidelines.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── LOGIN / REGISTER ── */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.slate50 }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
<ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          onPress={() => { setMode('splash'); setError(''); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 32 }}
        >
          <Text style={{ fontSize: 22, color: colors.slate800 }}>‹</Text>
          <Text style={{ fontSize: 13, color: colors.slate800 }}>Back</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{ width: 64, height: 64, backgroundColor: colors.slate900, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Waves size={30} color="#38bdf8" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: colors.slate900 }}>
            MetroFlow {mode === 'login' ? 'Login' : 'Sign Up'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.slate500, marginTop: 4 }}>
            {mode === 'login' ? 'Sign in to access real-time flood navigation' : 'Create your public motorist account'}
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          {mode === 'register' && (
            <View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.slate700, marginBottom: 6 }}>Full Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.slate200, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.slate900 }}
                placeholder="Juan Dela Cruz"
              />
            </View>
          )}
          <View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.slate700, marginBottom: 6 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.slate200, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.slate900 }}
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
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoComplete="new-password"
            />
          )}

          {error ? (
            <Text style={{ fontSize: 12, color: colors.red600, textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={{ backgroundColor: colors.slate900, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 4 }}
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {mode === 'login' ? 'Sign In' : 'Sign Up'}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setConfirmPassword(''); }}>
            <Text style={{ fontSize: 13, color: colors.slate600 }}>
              {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 6 }} onPress={goToApp}>
            <Text style={{ fontSize: 12, color: colors.slate400 }}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
</KeyboardAvoidingView>
    </SafeAreaView>
  );
}
