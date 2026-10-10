import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from 'react-native';
import { Button, Field } from '../components/ui';
import { useStore } from '../context/StoreProvider';
import { errorMessage } from '../lib/api';
import { STORE_NAME, WEB_URL } from '../lib/config';
import { colors } from '../lib/theme';

export default function Login() {
  const { login } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
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
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 }}>Welcome back</Text>
        <Text style={{ color: colors.muted, marginBottom: 20 }}>Log in to your {STORE_NAME} account</Text>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={() => void submit()} />
        {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}
        <Button title="Log in" loading={busy} disabled={!email || !password} onPress={() => void submit()} />
        <Pressable style={{ marginTop: 16 }} onPress={() => void Linking.openURL(`${WEB_URL}/forgot-password`)}>
          <Text style={{ color: colors.brand, textAlign: 'center' }}>Forgot password?</Text>
        </Pressable>
        <Pressable style={{ marginTop: 20 }} onPress={() => router.replace('/register')}>
          <Text style={{ color: colors.text, textAlign: 'center' }}>
            New here? <Text style={{ color: colors.brand, fontWeight: '700' }}>Create an account</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
