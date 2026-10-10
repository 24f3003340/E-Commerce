import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import { Card, Empty, Loading } from '../components/ui';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { colors } from '../lib/theme';
import type { Notification } from '../lib/types';

export default function Notifications() {
  const [items, setItems] = useState<Notification[] | null>(null);
  useEffect(() => {
    api<{ items: Notification[]; unread: number }>('/notifications')
      .then((d) => {
        setItems(d.items);
        if (d.unread) void api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
      })
      .catch(() => setItems([]));
  }, []);

  if (!items) return <Loading />;
  if (!items.length) return <Empty title="No notifications yet" subtitle="Order updates will appear here." />;
  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      renderItem={({ item }) => (
        <Pressable disabled={!item.data?.orderNumber} onPress={() => router.push(`/orders/${item.data?.orderNumber}`)}>
          <Card style={!item.readAt ? { borderColor: colors.brand } : undefined}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{item.title}</Text>
            <Text style={{ color: colors.text, marginTop: 2 }}>{item.body}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{formatDate(item.createdAt, true)}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}
