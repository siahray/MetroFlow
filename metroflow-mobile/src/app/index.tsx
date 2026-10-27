import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Waves, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../auth';
import { login as apiLogin, register as apiRegister } from '../api';

type Mode = 'splash' | 'login' | 'register';

export default function IndexScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [mode, setMode] = useState<Mode>('splash');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function goToApp() {
    router.replace('/(tabs)/home');
  }

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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'space-between' }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(219,234,254,0.8)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb', marginRight: 6 }} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#1d4ed8' }}>Live Flood Network</Text>
            </View>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Civic Transit Safe</Text>
          </View>

          {/* Hero */}
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <View style={{ width: 80, height: 80, backgroundColor: '#0f172a', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Waves size={40} color="#38bdf8" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 }}>MetroFlow</Text>
            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Safer Roads. Stronger Communities.</Text>

            <View style={{ backgroundColor: '#fff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 24, maxWidth: 300, width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} color="#0891b2" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e293b' }}>Real-Time Hydrologic Rerouting</Text>
              </View>
              <Text style={{ fontSize: 10, color: '#64748b', marginTop: 6, lineHeight: 15 }}>
                Calculates safe corridors based on your vehicle's ground clearance. Flood data is live-synced from the MDRRMC emergency network.
              </Text>
            </View>
          </View>

          {/* CTA */}
          <View style={{ gap: 12, marginBottom: 16 }}>
            <TouchableOpacity
              style={{ backgroundColor: '#0f172a', paddingVertical: 15, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
              onPress={() => setMode('login')}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Log In</Text>
              <ArrowRight size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: '#eff6ff', paddingVertical: 15, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' }}
              onPress={() => setMode('register')}
            >
              <Text style={{ color: '#1e3a8a', fontWeight: '700', fontSize: 14 }}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={goToApp}>
              <Text style={{ fontSize: 12, color: '#94a3b8' }}>Continue as Guest</Text>
            </TouchableOpacity>
            <Text style={{ textAlign: 'center', fontSize: 10, color: '#cbd5e1' }}>
              By continuing, you agree to the Safe Transit Guidelines.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── LOGIN / REGISTER ── */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          onPress={() => { setMode('splash'); setError(''); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 32 }}
        >
          <Text style={{ fontSize: 22, color: '#1e293b' }}>‹</Text>
          <Text style={{ fontSize: 13, color: '#1e293b' }}>Back</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{ width: 64, height: 64, backgroundColor: '#0f172a', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Waves size={30} color="#38bdf8" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#0f172a' }}>
            MetroFlow {mode === 'login' ? 'Login' : 'Sign Up'}
          </Text>
          <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {mode === 'login' ? 'Sign in to access real-time flood navigation' : 'Create your public motorist account'}
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          {mode === 'register' && (
            <View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155', marginBottom: 6 }}>Full Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: '#0f172a' }}
                placeholder="Juan Dela Cruz"
              />
            </View>
          )}
          <View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155', marginBottom: 6 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: '#0f172a' }}
              placeholder="you@example.com"
            />
          </View>
          <View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155', marginBottom: 6 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: '#0f172a' }}
              placeholder="••••••••"
            />
          </View>

          {error ? (
            <Text style={{ fontSize: 12, color: '#dc2626', textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={{ backgroundColor: '#0f172a', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 4 }}
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

          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
            <Text style={{ fontSize: 13, color: '#475569' }}>
              {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 6 }} onPress={goToApp}>
            <Text style={{ fontSize: 12, color: '#94a3b8' }}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
