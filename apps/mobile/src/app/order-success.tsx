import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../components/ui';
import { inr } from '../lib/format';
import { colors } from '../lib/theme';

export default function OrderSuccess() {
  const { orderNumbers = '', total } = useLocalSearchParams<{ orderNumbers?: string; total?: string }>();
  const numbers = orderNumbers.split(',').filter(Boolean);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 56, color: colors.success }}>✓</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 8 }}>Order placed!</Text>
      <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 8 }}>
        {numbers.length > 1 ? `Your items arrive in ${numbers.length} packages: ${numbers.join(', ')}` : `Order ${numbers[0] ?? ''}`}
      </Text>
      {total ? <Text style={{ marginTop: 4, color: colors.text }}>Pay {inr(Number(total))} on delivery</Text> : null}
      <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 24 }}>
        <Button title="View order" onPress={() => router.replace(numbers.length === 1 ? `/orders/${numbers[0]}` : '/orders')} />
        <Button title="Continue shopping" variant="outline" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}
