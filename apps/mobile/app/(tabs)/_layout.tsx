import { useCartCount, useChatLive, useChatUnreadQuery, useIsAuthenticated } from '@marketbd/api-client';
import { Tabs } from 'expo-router';
import { Home, LayoutGrid, MessageCircle, ShoppingCart, User } from 'lucide-react-native';
import { colors } from '@/components/ui';
import { useI18n } from '@/i18n';

export default function TabsLayout() {
  const { t } = useI18n();
  const cartCount = useCartCount();
  const authed = useIsAuthenticated();
  const chatLive = useChatLive();
  const { data: chatUnread } = useChatUnreadQuery('customer', { skip: !authed, pollingInterval: chatLive ? 0 : 30_000 });
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.common.home, headerShown: false, tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="categories" options={{ title: t.common.categories, headerShown: false, tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }} />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Message',
          headerShown: false,
          tabBarBadge: chatUnread && chatUnread.count > 0 ? chatUnread.count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent },
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t.common.cart,
          headerShown: false,
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent },
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="account" options={{ title: t.common.account, tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
