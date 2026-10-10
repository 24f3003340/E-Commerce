import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import { Card, Empty, Loading } from '../components/ui';
import { api } from '../lib/api';
import { formatDate, humanize, inr, RETURN_REASONS } from '../lib/format';
import { colors } from '../lib/theme';
import type { ReturnRequest } from '../lib/types';

export default function Returns() {
  const [items, setItems] = useState<ReturnRequest[] | null>(null);
  useEffect(() => {
    api<ReturnRequest[]>('/returns').then(setItems).catch(() => setItems([]));
  }, []);

  if (!items) return <Loading />;
  if (!items.length) return <Empty title="No returns" subtitle="You can return delivered items from the order page." />;
  return (
    <FlatList
      data={items}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      renderItem={({ item }) => (
        <Pressable disabled={!item.order} onPress={() => router.push(`/orders/${item.order?.orderNumber}`)}>
          <Card>
            <Text style={{ fontWeight: '700', color: colors.text }}>{item.returnNumber} · {humanize(item.status)}</Text>
            <Text style={{ color: colors.muted, marginTop: 2 }}>
              {item.order?.orderNumber} · {RETURN_REASONS[item.reason] ?? humanize(item.reason)} · {formatDate(item.createdAt)}
            </Text>
            {item.refundAmount > 0 && <Text style={{ color: colors.success, marginTop: 4 }}>Refund {inr(item.refundAmount)}</Text>}
          </Card>
        </Pressable>
      )}
    />
  );
}
