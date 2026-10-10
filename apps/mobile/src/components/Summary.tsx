import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';

export function Row({ label, value, green, bold }: { label: string; value: string; green?: boolean; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 }}>
      <Text style={{ color: colors.text, fontWeight: bold ? '800' : '400' }}>{label}</Text>
      <Text style={{ color: green ? colors.success : colors.text, fontWeight: bold ? '800' : '500' }}>{value}</Text>
    </View>
  );
}

export function Footer({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>{children}</View>;
}

const s = StyleSheet.create({
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
