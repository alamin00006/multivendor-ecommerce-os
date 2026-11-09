import { useCartCount } from '@marketbd/api-client';
import { Tabs } from 'expo-router';
import { Home, LayoutGrid, ShoppingCart, User } from 'lucide-react-native';
import { colors } from '@/components/ui';
import { useI18n } from '@/i18n';

export default function TabsLayout() {
  const { t } = useI18n();
  const cartCount = useCartCount();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.common.home, headerShown: false, tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="categories" options={{ title: t.common.categories, tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: t.common.cart,
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent },
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="account" options={{ title: t.common.account, tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
