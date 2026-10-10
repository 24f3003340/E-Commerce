import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { inr, ORDER_STATUS_LABEL } from '../lib/format';
import type { OrderStatus } from '../lib/types';
import { colors, radius } from '../lib/theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'buy' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg = variant === 'primary' ? colors.brand : variant === 'buy' ? colors.buy : 'transparent';
  const fg = variant === 'primary' ? '#fff' : variant === 'buy' ? colors.onBuy : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.brand },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, error ? { borderColor: colors.danger } : null]} {...props} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Price({ price, mrp, discountPct, size = 15 }: { price: number; mrp: number; discountPct?: number; size?: number }) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.price, { fontSize: size }]}>{inr(price)}</Text>
      {mrp > price && <Text style={styles.mrp}>{inr(mrp)}</Text>}
      {!!discountPct && discountPct > 0 && <Text style={styles.off}>{discountPct}% off</Text>}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

export function Empty({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={[styles.center, { padding: 24 }]}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: 16, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Chip({ label, active, onPress, disabled }: { label: string; active?: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        active && { borderColor: colors.brand, backgroundColor: colors.brandLight },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[styles.chipText, active && { color: colors.brand, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

export function StatusText({ status }: { status: OrderStatus }) {
  const color = status === 'DELIVERED' ? colors.success : status === 'CANCELLED' ? colors.danger : colors.brand;
  return <Text style={{ color, fontWeight: '700' }}>{ORDER_STATUS_LABEL[status]}</Text>;
}

export const styles = StyleSheet.create({
  button: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, color: colors.muted, marginBottom: 4, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  price: { fontWeight: '800', color: colors.text },
  mrp: { fontSize: 12, color: colors.muted, textDecorationLine: 'line-through' },
  off: { fontSize: 12, color: colors.success, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipText: { color: colors.text, fontSize: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10 },
});
