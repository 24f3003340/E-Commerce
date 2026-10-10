import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui';
import { useStore } from '../../context/StoreProvider';
import { api, errorMessage } from '../../lib/api';
import { STORE_NAME, WEB_URL } from '../../lib/config';
import { colors } from '../../lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export default function Account() {
  const { auth, logout, toast } = useStore();

  const deleteAccount = () =>
    Alert.alert('Delete account?', 'Your account will be deactivated and you will be logged out. Order records are kept as required by law.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('/me', { method: 'DELETE' });
            await logout();
            toast('Your account has been deleted');
          } catch (e) {
            toast(errorMessage(e));
          }
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={s.head}>
        {auth ? (
          <>
            <Text style={s.name}>{auth.user.name}</Text>
            <Text style={{ color: '#cbd2f0' }}>{auth.user.email}</Text>
          </>
        ) : (
          <>
            <Text style={s.name}>Welcome to {STORE_NAME}</Text>
            <Text style={{ color: '#cbd2f0', marginBottom: 12 }}>Log in to track orders and manage returns</Text>
            <Button title="Log in / Sign up" variant="buy" onPress={() => router.push('/login')} />
          </>
        )}
      </View>

      {auth && (
        <View style={s.group}>
          <Item icon="cube-outline" label="My orders" onPress={() => router.push('/orders')} />
          <Item icon="return-down-back-outline" label="Returns & refunds" onPress={() => router.push('/returns')} />
          <Item icon="location-outline" label="Saved addresses" onPress={() => router.push('/addresses')} />
          <Item icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
        </View>
      )}

      <View style={s.group}>
        <Item icon="help-circle-outline" label="FAQs" onPress={() => void Linking.openURL(`${WEB_URL}/faq`)} />
        <Item icon="call-outline" label="Contact us" onPress={() => void Linking.openURL(`${WEB_URL}/contact`)} />
        <Item icon="refresh-outline" label="Return policy" onPress={() => void Linking.openURL(`${WEB_URL}/return-policy`)} />
        <Item icon="document-text-outline" label="Terms of use" onPress={() => void Linking.openURL(`${WEB_URL}/terms`)} />
        <Item icon="shield-checkmark-outline" label="Privacy policy" onPress={() => void Linking.openURL(`${WEB_URL}/privacy`)} />
      </View>

      {auth && (
        <View style={s.group}>
          <Item icon="log-out-outline" label="Log out" onPress={() => void logout()} />
          <Item icon="trash-outline" label="Delete my account" danger onPress={deleteAccount} />
        </View>
      )}
    </ScrollView>
  );
}

function Item({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={s.item} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.brand} />
      <Text style={[s.itemText, danger && { color: colors.danger }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: { backgroundColor: colors.brandDark, padding: 20 },
  name: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  group: { backgroundColor: '#fff', marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  itemText: { flex: 1, fontSize: 15, color: colors.text },
});
