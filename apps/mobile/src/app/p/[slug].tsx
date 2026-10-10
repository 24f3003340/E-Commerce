import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '../../components/ProductCard';
import { Button, Card, Chip, Empty, Loading, Price, styles as ui } from '../../components/ui';
import { useStore } from '../../context/StoreProvider';
import { api, errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import type { ProductDetail } from '../../lib/types';

interface Serviceability {
  serviceable: boolean;
  codAvailable: boolean;
  estimatedDelivery?: { from: string; to: string };
}

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pincode, setPincode] = useState('');
  const [svc, setSvc] = useState<Serviceability | null>(null);
  const [svcError, setSvcError] = useState<string | null>(null);

  useEffect(() => {
    setProduct(null);
    api<ProductDetail>(`/products/${slug}`, { auth: false })
      .then((p) => {
        setProduct(p);
        const first = p.variants.find((v) => v.inStock) ?? p.variants[0];
        setColor(first?.color ?? null);
        const sizes = new Set(p.variants.map((v) => v.size).filter(Boolean));
        setSize(sizes.size === 1 ? (first?.size ?? null) : null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [slug]);

  const colorsList = useMemo(() => {
    const m = new Map<string, string | null>();
    product?.variants.forEach((v) => v.color && !m.has(v.color) && m.set(v.color, v.colorHex));
    return [...m.keys()];
  }, [product]);
  const sizesForColor = useMemo(() => product?.variants.filter((v) => (color ? v.color === color : true) && v.size) ?? [], [product, color]);
  const variant = product?.variants.find((v) => (color ? v.color === color : true) && (sizesForColor.length ? v.size === size : true));
  const images = useMemo(() => {
    if (!product) return [];
    const forColor = product.images.filter((i) => i.color === color);
    return forColor.length ? forColor : product.images.filter((i) => !i.color).length ? product.images.filter((i) => !i.color) : product.images;
  }, [product, color]);

  if (error) return <Empty title="Product not available" subtitle={error} action={<Button title="Go back" onPress={() => router.back()} />} />;
  if (!product) return <Loading />;

  const add = async (buyNow: boolean) => {
    if (!variant) return;
    setAdding(true);
    const ok = await addToCart(variant.id, 1);
    setAdding(false);
    if (ok && buyNow) router.push('/cart');
  };

  const checkPincode = async () => {
    setSvcError(null);
    try {
      setSvc(await api<Serviceability>(`/serviceability?pincode=${pincode}`, { auth: false }));
    } catch (e) {
      setSvc(null);
      setSvcError(errorMessage(e));
    }
  };

  const wished = wishlist.has(product.id);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: product.brand ?? '' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={images}
          keyExtractor={(i, idx) => `${i.url}-${idx}`}
          renderItem={({ item }) => <Image source={item.url} style={{ width, height: width * 1.2, backgroundColor: '#fff' }} contentFit="contain" />}
        />
        <View style={{ padding: 14, backgroundColor: '#fff' }}>
          {product.brand ? <Text style={s.brand}>{product.brand}</Text> : null}
          <Text style={s.name}>{product.name}</Text>
          <Price price={variant?.price ?? product.price} mrp={variant?.mrp ?? product.mrp} discountPct={product.discountPct} size={22} />
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Inclusive of all taxes</Text>
          {product.ratingCount > 0 && (
            <Text style={s.rating}>★ {product.ratingAvg.toFixed(1)} · {product.ratingCount} ratings</Text>
          )}
          {product.seller ? <Text style={{ color: colors.muted, marginTop: 6 }}>Sold by {product.seller.storeName}</Text> : null}
        </View>

        {colorsList.length > 1 && (
          <View style={s.section}>
            <Text style={ui.sectionTitle}>Colour: {color}</Text>
            <View style={s.wrap}>
              {colorsList.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={c === color}
                  onPress={() => {
                    setColor(c);
                    setSize(null);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {sizesForColor.length > 0 && (
          <View style={s.section}>
            <Text style={ui.sectionTitle}>Select size</Text>
            <View style={s.wrap}>
              {sizesForColor.map((v) => (
                <Chip key={v.id} label={v.size ?? ''} active={v.size === size} disabled={!v.inStock} onPress={() => setSize(v.size)} />
              ))}
            </View>
            {variant && variant.inStock && variant.stock <= 5 && <Text style={{ color: colors.warning, marginTop: 8 }}>Only {variant.stock} left!</Text>}
          </View>
        )}

        <View style={s.section}>
          <Text style={ui.sectionTitle}>Check delivery</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={pincode}
              onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="Enter pincode"
              placeholderTextColor={colors.muted}
              style={s.pin}
            />
            <Button title="Check" variant="outline" disabled={pincode.length !== 6} onPress={() => void checkPincode()} />
          </View>
          {svcError ? <Text style={{ color: colors.danger, marginTop: 6 }}>{svcError}</Text> : null}
          {svc && (
            <Text style={{ marginTop: 8, color: svc.serviceable ? colors.success : colors.danger }}>
              {svc.serviceable
                ? `Delivery by ${svc.estimatedDelivery ? formatDate(svc.estimatedDelivery.to) : 'a few days'}${svc.codAvailable ? ' · Cash on delivery available' : ''}`
                : 'Sorry, we do not deliver to this pincode yet.'}
            </Text>
          )}
          <Text style={{ color: colors.muted, marginTop: 8 }}>
            {product.returnPolicy.isReturnable ? `Easy ${product.returnPolicy.returnWindowDays}-day returns` : 'This item is not returnable'}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={ui.sectionTitle}>Product details</Text>
          <Text style={{ color: colors.text, lineHeight: 21 }}>{product.description}</Text>
          {product.material ? <Spec k="Material" v={product.material} /> : null}
          {product.specifications && Object.entries(product.specifications).map(([k, v]) => <Spec key={k} k={k} v={String(v)} />)}
        </View>

        {product.reviews.length > 0 && (
          <View style={s.section}>
            <Text style={ui.sectionTitle}>Customer reviews</Text>
            {product.reviews.slice(0, 5).map((r) => (
              <Card key={r.id} style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: '700', color: colors.success }}>★ {r.rating} {r.title ? <Text style={{ color: colors.text }}>· {r.title}</Text> : null}</Text>
                {r.comment ? <Text style={{ marginTop: 4, color: colors.text }}>{r.comment}</Text> : null}
                <Text style={{ marginTop: 4, color: colors.muted, fontSize: 12 }}>
                  {r.author} · {formatDate(r.createdAt)}{r.verifiedPurchase ? ' · Verified buyer' : ''}
                </Text>
              </Card>
            ))}
          </View>
        )}

        {product.related.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={[ui.sectionTitle, { paddingHorizontal: 14 }]}>You may also like</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={product.related}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
              renderItem={({ item }) => <ProductCard product={item} width={150} />}
            />
          </View>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable style={s.wish} onPress={() => void toggleWishlist(product.id)} accessibilityLabel="Wishlist">
          <Text style={{ fontSize: 22, color: wished ? colors.buy : colors.text }}>{wished ? '♥' : '♡'}</Text>
        </Pressable>
        {variant && !variant.inStock ? (
          <Button title="Out of stock" disabled style={{ flex: 1 }} />
        ) : !variant ? (
          <Button title="Select a size" disabled style={{ flex: 1 }} />
        ) : (
          <>
            <Button title="Add to bag" variant="outline" loading={adding} style={{ flex: 1 }} onPress={() => void add(false)} />
            <Button title="Buy now" variant="buy" disabled={adding} style={{ flex: 1 }} onPress={() => void add(true)} />
          </>
        )}
      </View>
    </View>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 6 }}>
      <Text style={{ width: 110, color: colors.muted }}>{k}</Text>
      <Text style={{ flex: 1, color: colors.text }}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  brand: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  name: { fontSize: 18, color: colors.text, marginVertical: 4 },
  rating: { marginTop: 8, color: colors.success, fontWeight: '700' },
  section: { backgroundColor: '#fff', padding: 14, marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pin: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 48, fontSize: 16, color: colors.text },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 10, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  wish: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
