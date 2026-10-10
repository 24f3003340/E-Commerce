import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Field } from '../components/ui';
import { useStore } from '../context/StoreProvider';
import { api, errorMessage } from '../lib/api';
import { colors } from '../lib/theme';
import type { Address } from '../lib/types';

const EMPTY = { name: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '', isDefault: false };

export default function AddressForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { auth, toast } = useStore();
  const [form, setForm] = useState({ ...EMPTY, name: auth?.user.name ?? '', phone: auth?.user.phone ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!id) return;
    api<Address[]>('/me/addresses').then((list) => {
      const a = list.find((x) => x.id === id);
      if (a) setForm({ name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 ?? '', landmark: a.landmark ?? '', city: a.city, state: a.state, pincode: a.pincode, isDefault: a.isDefault });
    });
  }, [id]);

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { ...form, line2: form.line2 || undefined, landmark: form.landmark || undefined };
    try {
      await api(id ? `/me/addresses/${id}` : '/me/addresses', { method: id ? 'PUT' : 'POST', body });
      toast('Address saved');
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const valid = form.name && /^[6-9]\d{9}$/.test(form.phone) && form.line1 && form.city && form.state && /^[1-9]\d{5}$/.test(form.pincode);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id ? 'Edit address' : 'Add address' }} />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Field label="Full name" value={form.name} onChangeText={set('name')} autoComplete="name" />
        <Field label="Mobile number" value={form.phone} onChangeText={(t) => set('phone')(t.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" autoComplete="tel" />
        <Field label="Pincode" value={form.pincode} onChangeText={(t) => set('pincode')(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="postal-code" />
        <Field label="House no., building, street" value={form.line1} onChangeText={set('line1')} autoComplete="street-address" />
        <Field label="Area, colony (optional)" value={form.line2} onChangeText={set('line2')} />
        <Field label="Landmark (optional)" value={form.landmark} onChangeText={set('landmark')} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="City" value={form.city} onChangeText={set('city')} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="State" value={form.state} onChangeText={set('state')} />
          </View>
        </View>
        <Pressable onPress={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.brand, backgroundColor: form.isDefault ? colors.brand : '#fff', marginRight: 10 }} />
          <Text style={{ color: colors.text }}>Make this my default address</Text>
        </Pressable>
        {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}
        <Button title="Save address" loading={busy} disabled={!valid} onPress={() => void save()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
