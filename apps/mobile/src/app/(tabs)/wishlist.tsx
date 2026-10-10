import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList } from 'react-native';
import { ProductCard } from '../../components/ProductCard';
import { Button, Empty, Loading } from '../../components/ui';
import { useStore } from '../../context/StoreProvider';
import { api } from '../../lib/api';
import type { ListingProduct } from '../../lib/types';

export default function Wishlist() {
  const { auth, wishlist } = useStore();
  const [items, setItems] = useState<ListingProduct[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!auth) return;
      api<ListingProduct[]>('/wishlist').then(setItems).catch(() => setItems([]));
    }, [auth]),
  );

  if (!auth) return <Empty title="Your wishlist" subtitle="Log in to save products you love." action={<Button title="Log in" onPress={() => router.push('/login')} />} />;
  if (!items) return <Loading />;
  const visible = items.filter((p) => wishlist.has(p.id));
  if (!visible.length) return <Empty title="Your wishlist is empty" subtitle="Tap ♡ on any product to save it here." action={<Button title="Start shopping" onPress={() => router.push('/products')} />} />;
  return (
    <FlatList
      data={visible}
      numColumns={2}
      keyExtractor={(p) => p.id}
      columnWrapperStyle={{ gap: 10 }}
      contentContainerStyle={{ padding: 10, gap: 10 }}
      renderItem={({ item }) => <ProductCard product={item} />}
    />
  );
}
