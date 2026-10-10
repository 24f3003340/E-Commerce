import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from 'react-native';
import { Button, Field } from '../components/ui';
import { useStore } from '../context/StoreProvider';
import { errorMessage } from '../lib/api';
import { WEB_URL } from '../lib/config';
import { colors } from '../lib/theme';

export default function Register() {
  const { register } = useStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password: form.password });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Field label="Full name" value={form.name} onChangeText={set('name')} autoComplete="name" textContentType="name" />
        <Field label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field label="Mobile number (optional)" value={form.phone} onChangeText={(t) => set('phone')(t.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" autoComplete="tel" />
        <Field label="Password (8+ characters, letters and numbers)" value={form.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}
        <Button title="Create account" loading={busy} disabled={!form.name || !form.email || form.password.length < 8} onPress={() => void submit()} />
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 12 }}>
          By continuing you agree to our{' '}
          <Text style={{ color: colors.brand }} onPress={() => void Linking.openURL(`${WEB_URL}/terms`)}>Terms</Text> and{' '}
          <Text style={{ color: colors.brand }} onPress={() => void Linking.openURL(`${WEB_URL}/privacy`)}>Privacy Policy</Text>.
        </Text>
        <Pressable style={{ marginTop: 20 }} onPress={() => router.replace('/login')}>
          <Text style={{ color: colors.text, textAlign: 'center' }}>
            Already have an account? <Text style={{ color: colors.brand, fontWeight: '700' }}>Log in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
