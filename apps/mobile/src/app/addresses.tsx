import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Empty, Loading } from '../components/ui';
import { useStore } from '../context/StoreProvider';
import { api, errorMessage } from '../lib/api';
import { colors } from '../lib/theme';
import type { Address } from '../lib/types';

export default function Addresses() {
  const { toast } = useStore();
  const [list, setList] = useState<Address[] | null>(null);
  const load = useCallback(() => {
    api<Address[]>('/me/addresses').then(setList).catch(() => setList([]));
  }, []);
  useFocusEffect(load);

  if (!list) return <Loading />;
  const remove = (a: Address) =>
    Alert.alert('Delete this address?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/me/addresses/${a.id}`, { method: 'DELETE' });
            load();
          } catch (e) {
            toast(errorMessage(e));
          }
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
      {list.length === 0 && <Empty title="No saved addresses" />}
      {list.map((a) => (
        <Card key={a.id}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{a.name} · {a.phone}{a.isDefault ? '  (Default)' : ''}</Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>{[a.line1, a.line2, a.landmark, a.city, a.state].filter(Boolean).join(', ')} – {a.pincode}</Text>
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
            <Pressable onPress={() => router.push({ pathname: '/address-form', params: { id: a.id } })}>
              <Text style={{ color: colors.brand, fontWeight: '600' }}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => remove(a)}>
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete</Text>
            </Pressable>
          </View>
        </Card>
      ))}
      <Button title="+ Add new address" onPress={() => router.push('/address-form')} />
    </ScrollView>
  );
}
