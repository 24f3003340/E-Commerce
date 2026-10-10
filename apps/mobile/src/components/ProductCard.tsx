import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../context/StoreProvider';
import { colors, radius } from '../lib/theme';
import type { ListingProduct } from '../lib/types';
import { Price } from './ui';

export function ProductCard({ product, width }: { product: ListingProduct; width?: number }) {
  const { wishlist, toggleWishlist } = useStore();
  const wished = wishlist.has(product.id);
  return (
    <Pressable style={[s.card, width ? { width } : { flex: 1 }]} onPress={() => router.push(`/p/${product.slug}`)}>
      <View>
        <Image source={product.images[0]?.url} style={s.image} contentFit="cover" transition={150} />
        <Pressable hitSlop={10} style={s.heart} onPress={() => void toggleWishlist(product.id)} accessibilityLabel="Wishlist">
          <Text style={{ fontSize: 16, color: wished ? colors.buy : colors.muted }}>{wished ? '♥' : '♡'}</Text>
        </Pressable>
        {!product.inStock && (
          <View style={s.oos}>
            <Text style={s.oosText}>Out of stock</Text>
          </View>
        )}
      </View>
      <View style={{ padding: 8 }}>
        {product.brand ? <Text style={s.brand} numberOfLines={1}>{product.brand}</Text> : null}
        <Text style={s.name} numberOfLines={2}>{product.name}</Text>
        <Price price={product.price} mrp={product.mrp} discountPct={product.discountPct} size={14} />
        {product.ratingCount > 0 && (
          <Text style={s.rating}>★ {product.ratingAvg} <Text style={{ color: colors.muted }}>({product.ratingCount})</Text></Text>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  image: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.page },
  heart: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 999, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  oos: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15,23,42,0.6)', padding: 4 },
  oosText: { color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '600' },
  brand: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  name: { fontSize: 13, color: colors.text, marginVertical: 2, minHeight: 34 },
  rating: { fontSize: 12, color: colors.success, fontWeight: '700', marginTop: 2 },
});
