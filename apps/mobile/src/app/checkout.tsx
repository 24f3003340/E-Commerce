import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Footer, Row } from '../components/Summary';
import { Button, Card, Empty, Loading, styles as ui } from '../components/ui';
import { useStore } from '../context/StoreProvider';
import { api, errorMessage } from '../lib/api';
import { inr } from '../lib/format';
import { colors, radius } from '../lib/theme';
import type { Address, Cart, Order } from '../lib/types';

interface PublicCoupon {
  code: string;
  description: string | null;
}

export default function Checkout() {
  const { refreshCart, toast } = useStore();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<'STANDARD' | 'EXPRESS'>('STANDARD');
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState<string | undefined>();
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  const [quote, setQuote] = useState<Cart | null>(null);
  const [placing, setPlacing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api<Address[]>('/me/addresses')
        .then((list) => {
          setAddresses(list);
          setAddressId((cur) => (cur && list.some((a) => a.id === cur) ? cur : (list.find((a) => a.isDefault) ?? list[0])?.id ?? null));
        })
        .catch(() => setAddresses([]));
    }, []),
  );

  useEffect(() => {
    api<PublicCoupon[]>('/coupons', { auth: false }).then(setCoupons).catch(() => undefined);
  }, []);

  const loadQuote = useCallback(async () => {
    try {
      const q = await api<Cart>('/cart/quote', { method: 'POST', body: { couponCode: applied, paymentMethod: 'COD', deliveryMethod: delivery } });
      setQuote(q);
      if (q.couponError) {
        toast(q.couponError);
        setApplied(undefined);
      }
    } catch (e) {
      toast(errorMessage(e));
    }
  }, [applied, delivery, toast]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  if (!addresses || !quote) return <Loading />;
  if (!quote.items.length) return <Empty title="Your bag is empty" action={<Button title="Continue shopping" onPress={() => router.replace('/')} />} />;

  const s = quote.summary;

  const place = async () => {
    if (!addressId) return;
    setPlacing(true);
    try {
      const res = await api<{ order: Order; orders: Order[] }>('/orders', {
        method: 'POST',
        body: { addressId, paymentMethod: 'COD', deliveryMethod: delivery, couponCode: applied },
      });
      await refreshCart();
      router.replace({ pathname: '/order-success', params: { orderNumbers: res.orders.map((o) => o.orderNumber).join(','), total: String(s.total) } });
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 110 }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={ui.sectionTitle}>Deliver to</Text>
            <Pressable onPress={() => router.push('/address-form')}>
              <Text style={{ color: colors.brand, fontWeight: '700' }}>+ Add new</Text>
            </Pressable>
          </View>
          {addresses.length === 0 && <Text style={{ color: colors.muted }}>Add a delivery address to continue.</Text>}
          {addresses.map((a) => (
            <Pressable key={a.id} onPress={() => setAddressId(a.id)} style={{ padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: a.id === addressId ? colors.brand : colors.border, marginBottom: 8, backgroundColor: a.id === addressId ? colors.brandLight : '#fff' }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{a.name} · {a.phone}</Text>
              <Text style={{ color: colors.muted, marginTop: 2 }}>
                {[a.line1, a.line2, a.landmark, a.city, a.state].filter(Boolean).join(', ')} – {a.pincode}
              </Text>
            </Pressable>
          ))}
        </Card>

        <Card>
          <Text style={ui.sectionTitle}>Delivery speed</Text>
          {(['STANDARD', 'EXPRESS'] as const).map((d) => (
            <Pressable key={d} onPress={() => setDelivery(d)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
              <Radio on={delivery === d} />
              <Text style={{ color: colors.text }}>{d === 'STANDARD' ? 'Standard delivery' : 'Express delivery'}</Text>
            </Pressable>
          ))}
        </Card>

        <Card>
          <Text style={ui.sectionTitle}>Coupon</Text>
          {applied ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.success, fontWeight: '700' }}>{applied} applied</Text>
              <Pressable onPress={() => setApplied(undefined)}>
                <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={coupon}
                  onChangeText={(t) => setCoupon(t.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="Enter coupon code"
                  placeholderTextColor={colors.muted}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 48, color: colors.text }}
                />
                <Button title="Apply" variant="outline" disabled={!coupon.trim()} onPress={() => setApplied(coupon.trim())} />
              </View>
              {coupons.map((c) => (
                <Pressable key={c.code} onPress={() => setApplied(c.code)} style={{ marginTop: 8 }}>
                  <Text style={{ color: colors.brand, fontWeight: '700' }}>{c.code} <Text style={{ color: colors.muted, fontWeight: '400' }}>{c.description ?? ''}</Text></Text>
                </Pressable>
              ))}
            </>
          )}
        </Card>

        <Card>
          <Text style={ui.sectionTitle}>Payment</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
            <Radio on />
            <View>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Cash on delivery</Text>
              {s.codFee > 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>COD fee {inr(s.codFee)}</Text>}
            </View>
          </View>
          {!s.codAvailable && <Text style={{ color: colors.danger, marginTop: 6 }}>Cash on delivery is not available for this order.</Text>}
        </Card>

        <Card>
          <Text style={ui.sectionTitle}>Price details</Text>
          <Row label={`Price (${s.itemCount} items)`} value={inr(s.mrpTotal)} />
          {s.productDiscount > 0 && <Row label="Discount" value={`− ${inr(s.productDiscount)}`} green />}
          {s.couponDiscount > 0 && <Row label="Coupon" value={`− ${inr(s.couponDiscount)}`} green />}
          <Row label="Delivery" value={s.shippingFee ? inr(s.shippingFee) : 'FREE'} green={!s.shippingFee} />
          {s.codFee > 0 && <Row label="COD fee" value={inr(s.codFee)} />}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
          <Row label="Amount payable" value={inr(s.total)} bold />
        </Card>
      </ScrollView>
      <Footer>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>{inr(s.total)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Pay on delivery</Text>
        </View>
        <Button title="Confirm order" variant="buy" style={{ flex: 1 }} loading={placing} disabled={!addressId || !s.codAvailable || quote.hasIssues} onPress={() => void place()} />
      </Footer>
    </View>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
      {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} />}
    </View>
  );
}
