import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Row } from '../../components/Summary';
import { Button, Card, Chip, Empty, Loading, StatusText, styles as ui } from '../../components/ui';
import { useStore } from '../../context/StoreProvider';
import { api, errorMessage } from '../../lib/api';
import { formatDate, humanize, inr, ORDER_STATUS_LABEL, RETURN_REASONS } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import type { Order, OrderItem } from '../../lib/types';

interface Eligibility {
  eligible: boolean;
  reason?: string;
  items: { orderItemId: string; productName: string; variantLabel: string; returnableQuantity: number; returnBy: string }[];
}

export default function OrderDetail() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const { toast } = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [reviewing, setReviewing] = useState<OrderItem | null>(null);

  const load = useCallback(async () => {
    try {
      setOrder(await api<Order>(`/orders/${orderNumber}`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [orderNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Empty title="Order not found" subtitle={error} />;
  if (!order) return <Loading />;

  const cancel = () =>
    Alert.alert('Cancel this order?', undefined, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setOrder(await api<Order>(`/orders/${order.orderNumber}/cancel`, { method: 'POST', body: { reason: 'Cancelled from app' } }));
            toast('Order cancelled');
          } catch (e) {
            toast(errorMessage(e));
          }
        },
      },
    ]);

  const a = order.shippingAddress;
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 32 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '800', color: colors.text }}>{order.orderNumber}</Text>
          <StatusText status={order.status} />
        </View>
        <Text style={{ color: colors.muted, marginTop: 2 }}>Placed on {formatDate(order.createdAt, true)}</Text>
        {order.seller ? <Text style={{ color: colors.muted }}>Sold by {order.seller.storeName}</Text> : null}
        {order.cancelReason ? <Text style={{ color: colors.danger, marginTop: 4 }}>{order.cancelReason}</Text> : null}
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Items</Text>
        {order.items.map((i) => (
          <View key={i.id} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <Image source={i.imageUrl} style={{ width: 56, height: 72, borderRadius: 4, backgroundColor: colors.page }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={2}>{i.productName}</Text>
              <Text style={{ color: colors.muted }}>{i.variantLabel} · Qty {i.quantity}</Text>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{inr(i.total)}</Text>
              {order.status === 'DELIVERED' && (
                <Pressable onPress={() => setReviewing(i)}>
                  <Text style={{ color: colors.brand, fontWeight: '600', marginTop: 4 }}>Rate & review</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Tracking</Text>
        {order.history.map((h) => (
          <View key={h.id} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand, marginTop: 5 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{ORDER_STATUS_LABEL[h.status]}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{formatDate(h.createdAt, true)}{h.note ? ` · ${h.note}` : ''}</Text>
            </View>
          </View>
        ))}
        {order.shipments.map((sh) => (
          <View key={sh.id} style={{ marginTop: 6 }}>
            <Text style={{ color: colors.text }}>{sh.carrier}{sh.awb ? ` · AWB ${sh.awb}` : ''}</Text>
            {sh.trackingUrl ? (
              <Pressable onPress={() => void Linking.openURL(sh.trackingUrl!)}>
                <Text style={{ color: colors.brand, fontWeight: '600' }}>Track with courier</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Delivery address</Text>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{a.name} · {a.phone}</Text>
        <Text style={{ color: colors.muted }}>{[a.line1, a.line2, a.landmark, a.city, a.state].filter(Boolean).join(', ')} – {a.pincode}</Text>
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Payment</Text>
        <Row label="Items" value={inr(order.subtotal)} />
        {order.discount > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`− ${inr(order.discount)}`} green />}
        <Row label="Delivery" value={order.shippingFee ? inr(order.shippingFee) : 'FREE'} />
        {order.codFee > 0 && <Row label="COD fee" value={inr(order.codFee)} />}
        <Row label="Total" value={inr(order.total)} bold />
        <Text style={{ color: colors.muted, marginTop: 6 }}>
          {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Paid online'} · {humanize(order.paymentStatus)}
        </Text>
        {order.refunds.map((r) => (
          <Text key={r.id} style={{ color: colors.success, marginTop: 4 }}>Refund {inr(r.amount)} · {humanize(r.status)}</Text>
        ))}
      </Card>

      {order.returns.map((r) => (
        <Card key={r.id}>
          <Text style={{ fontWeight: '700', color: colors.text }}>Return {r.returnNumber}</Text>
          <Text style={{ color: colors.muted }}>{humanize(r.status)} · {RETURN_REASONS[r.reason] ?? humanize(r.reason)}</Text>
          {r.adminNote ? <Text style={{ color: colors.text, marginTop: 4 }}>{r.adminNote}</Text> : null}
        </Card>
      ))}

      {order.canCancel && <Button title="Cancel order" variant="outline" onPress={cancel} />}
      {order.canReturn && <Button title="Return items" variant="outline" onPress={() => setReturning(true)} />}

      <ReturnSheet visible={returning} order={order} onClose={() => setReturning(false)} onDone={() => { setReturning(false); void load(); }} />
      <ReviewSheet item={reviewing} onClose={() => setReviewing(null)} />
    </ScrollView>
  );
}

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' }} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%' }}>
        <Text style={ui.sectionTitle}>{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ReturnSheet({ visible, order, onClose, onDone }: { visible: boolean; order: Order; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore();
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('WRONG_SIZE');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) api<Eligibility>(`/returns/eligibility/${order.orderNumber}`).then(setElig).catch(() => setElig({ eligible: false, items: [] }));
  }, [visible, order.orderNumber]);

  const items = Object.entries(qty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
  const submit = async () => {
    setBusy(true);
    try {
      await api('/returns', { method: 'POST', body: { orderNumber: order.orderNumber, items, reason, comment: comment || undefined } });
      toast('Return requested');
      onDone();
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title="Request a return" onClose={onClose}>
      {!elig ? (
        <Loading />
      ) : !elig.eligible ? (
        <Text style={{ color: colors.muted }}>{elig.reason ?? 'The return window for this order has closed.'}</Text>
      ) : (
        <View>
          {elig.items.filter((i) => i.returnableQuantity > 0).map((i) => (
            <View key={i.orderItemId} style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{i.productName}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{i.variantLabel} · return by {formatDate(i.returnBy)}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                {Array.from({ length: i.returnableQuantity + 1 }, (_, n) => (
                  <Chip key={n} label={n === 0 ? 'Keep' : `Return ${n}`} active={(qty[i.orderItemId] ?? 0) === n} onPress={() => setQty((q) => ({ ...q, [i.orderItemId]: n }))} />
                ))}
              </View>
            </View>
          ))}
          <Text style={[ui.label, { marginTop: 4 }]}>Reason</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {Object.entries(RETURN_REASONS).map(([k, v]) => <Chip key={k} label={v} active={reason === k} onPress={() => setReason(k)} />)}
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Anything else? (optional)"
            placeholderTextColor={colors.muted}
            multiline
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, minHeight: 70, color: colors.text, marginBottom: 12 }}
          />
          <Button title="Submit return" loading={busy} disabled={!items.length} onPress={() => void submit()} />
        </View>
      )}
    </Sheet>
  );
}

function ReviewSheet({ item, onClose }: { item: OrderItem | null; onClose: () => void }) {
  const { toast } = useStore();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await api(`/products/${item.productId}/reviews`, { method: 'POST', body: { rating, title: title || undefined, comment: comment || undefined } });
      toast('Thanks for your review!');
      onClose();
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={!!item} title={item ? `Review ${item.productName}` : ''} onClose={onClose}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
            <Text style={{ fontSize: 32, color: n <= rating ? '#f59e0b' : colors.border }}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={title} onChangeText={setTitle} placeholder="Title (optional)" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, color: colors.text, marginBottom: 10 }} />
      <TextInput value={comment} onChangeText={setComment} placeholder="What did you like or dislike?" placeholderTextColor={colors.muted} multiline style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, minHeight: 80, color: colors.text, marginBottom: 12 }} />
      <Button title="Submit review" loading={busy} onPress={() => void submit()} />
    </Sheet>
  );
}
