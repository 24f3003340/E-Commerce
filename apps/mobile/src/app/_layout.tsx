import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../context/StoreProvider';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.brandDark },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.page },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Log in', presentation: 'modal' }} />
          <Stack.Screen name="register" options={{ title: 'Create account', presentation: 'modal' }} />
          <Stack.Screen name="products" options={{ title: 'Products' }} />
          <Stack.Screen name="search" options={{ title: 'Search' }} />
          <Stack.Screen name="p/[slug]" options={{ title: '' }} />
          <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
          <Stack.Screen name="order-success" options={{ title: 'Order placed', headerBackVisible: false, gestureEnabled: false }} />
          <Stack.Screen name="orders/index" options={{ title: 'My orders' }} />
          <Stack.Screen name="orders/[orderNumber]" options={{ title: 'Order details' }} />
          <Stack.Screen name="addresses" options={{ title: 'Saved addresses' }} />
          <Stack.Screen name="address-form" options={{ title: 'Add address', presentation: 'modal' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="returns" options={{ title: 'My returns' }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
