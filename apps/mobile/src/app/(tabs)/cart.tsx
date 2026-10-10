import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Footer, Row } from '../../components/Summary';
import { Button, Card, Empty, Loading, Price, styles as ui } from '../../components/ui';
import { useStore } from '../../context/StoreProvider';
import { api, errorMessage } from '../../lib/api';
import { inr } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import type { Cart } from '../../lib/types';

const ISSUE_TEXT = { UNAVAILABLE: 'No longer available', OUT_OF_STOCK: 'Out of stock', INSUFFICIENT_STOCK: 'Only a few left — reduce quantity' };

export default function CartScreen() {
  const { auth, refreshCart, toast } = useStore();
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (auth) void refreshCart().then(setCart);
    }, [auth, refreshCart]),
  );

  if (!auth) return <Empty title="Your bag" subtitle="Log in to add items to your bag and check out." action={<Button title="Log in" onPress={() => router.push('/login')} />} />;
  if (!cart) return <Loading />;
  if (!cart.items.length) return <Empty title="Your bag is empty" subtitle="Add items you like and they will show up here." action={<Button title="Start shopping" onPress={() => router.push('/products')} />} />;

  const change = async (id: string, quantity: number) => {
    setBusy(id);
    try {
      if (quantity <= 0) await api(`/cart/items/${id}`, { method: 'DELETE' });
      else await api(`/cart/items/${id}`, { method: 'PATCH', body: { quantity } });
      setCart(await refreshCart());
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const s = cart.summary;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 110 }}>
        {s.freeShippingThreshold > 0 && s.subtotal < s.freeShippingThreshold && (
          <Text style={st.note}>Add {inr(s.freeShippingThreshold - s.subtotal)} more for free delivery</Text>
        )}
        {cart.items.map((item) => (
          <Card key={item.id} style={{ flexDirection: 'row', gap: 12, opacity: busy === item.id ? 0.6 : 1 }}>
            <Pressable onPress={() => router.push(`/p/${item.product.slug}`)}>
              <Image source={item.image} style={st.img} contentFit="cover" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '600' }}>{item.product.name}</Text>
              <Text style={{ color: colors.muted, marginVertical: 2 }}>{item.variant.label}</Text>
              {item.soldBy ? <Text style={{ color: colors.muted, fontSize: 12 }}>Sold by {item.soldBy}</Text> : null}
              <Price price={item.variant.price} mrp={item.variant.mrp} />
              {item.issue ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 2 }}>{ISSUE_TEXT[item.issue]}</Text> : null}
              <View style={st.qtyRow}>
                <Pressable style={st.qtyBtn} disabled={!!busy} onPress={() => void change(item.id, item.quantity - 1)}>
                  <Text style={st.qtyText}>−</Text>
                </Pressable>
                <Text style={{ minWidth: 24, textAlign: 'center', fontWeight: '700' }}>{item.quantity}</Text>
                <Pressable style={st.qtyBtn} disabled={!!busy || item.quantity >= item.variant.maxQuantity} onPress={() => void change(item.id, item.quantity + 1)}>
                  <Text style={st.qtyText}>+</Text>
                </Pressable>
                <Pressable style={{ marginLeft: 'auto' }} disabled={!!busy} onPress={() => void change(item.id, 0)}>
                  <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
                </Pressable>
              </View>
            </View>
          </Card>
        ))}
        <Card>
          <Text style={ui.sectionTitle}>Price details</Text>
          <Row label={`Price (${s.itemCount} items)`} value={inr(s.mrpTotal)} />
          {s.productDiscount > 0 && <Row label="Discount" value={`− ${inr(s.productDiscount)}`} green />}
          <Row label="Delivery" value={s.shippingFee ? inr(s.shippingFee) : 'FREE'} green={!s.shippingFee} />
          <View style={st.divider} />
          <Row label="Total" value={inr(s.subtotal + s.shippingFee)} bold />
          {s.packageCount > 1 && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Items from {s.packageCount} sellers arrive in separate packages.</Text>}
        </Card>
      </ScrollView>
      <Footer>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>{inr(s.subtotal + s.shippingFee)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Total</Text>
        </View>
        <Button title="Place order" variant="buy" style={{ flex: 1 }} disabled={cart.hasIssues} onPress={() => router.push('/checkout')} />
      </Footer>
    </View>
  );
}

const st = StyleSheet.create({
  note: { backgroundColor: colors.brandLight, color: colors.brand, padding: 10, borderRadius: radius.md, fontWeight: '600' },
  img: { width: 80, height: 104, borderRadius: radius.sm, backgroundColor: colors.page },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: '700', color: colors.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 8 },
});
