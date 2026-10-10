import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Button, Card, Empty, Loading, StatusText } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDate, inr } from '../../lib/format';
import { colors } from '../../lib/theme';
import type { OrderSummary, Paginated } from '../../lib/types';

export default function Orders() {
  const [items, setItems] = useState<OrderSummary[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (next: number) => {
    setLoading(true);
    try {
      const res = await api<Paginated<OrderSummary>>(`/orders?page=${next}`);
      setItems((prev) => (next === 1 || !prev ? res.items : [...prev, ...res.items]));
      setPage(res.page);
      setPages(res.pages);
    } catch {
      setItems((prev) => prev ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  if (!items) return <Loading />;
  if (!items.length) return <Empty title="No orders yet" subtitle="Your orders will appear here." action={<Button title="Start shopping" onPress={() => router.replace('/')} />} />;
  return (
    <FlatList
      data={items}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      onEndReached={() => !loading && page < pages && void load(page + 1)}
      ListFooterComponent={loading ? <ActivityIndicator color={colors.brand} /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/orders/${item.orderNumber}`)}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{item.orderNumber}</Text>
              <StatusText status={item.status} />
            </View>
            <Text style={{ color: colors.muted, marginTop: 2 }}>{formatDate(item.createdAt)} · {inr(item.total)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {item.items.slice(0, 4).map((i, idx) => (
                <Image key={idx} source={i.imageUrl} style={{ width: 48, height: 60, borderRadius: 4, backgroundColor: colors.page }} />
              ))}
              {item.items.length > 4 && <Text style={{ alignSelf: 'center', color: colors.muted }}>+{item.items.length - 4}</Text>}
            </View>
          </Card>
        </Pressable>
      )}
    />
  );
}
