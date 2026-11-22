import { useOrdersQuery } from '@marketbd/api-client';
import type { OrderListQuery } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Package } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { EmptyCard, UnderlineTabs } from '@/components/account';
import { Badge, colors, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { useRequireAuth } from '@/lib/use-require-auth';

// Same tabs as the website; each maps to a real status (there is no separate "out for delivery" step).
const TABS = [
  { key: 'all', label: 'All', query: {} },
  { key: 'to-pay', label: 'To Pay', query: { toPay: true } },
  { key: 'pending', label: 'Pending', query: { status: 'PENDING' } },
  { key: 'confirmed', label: 'Confirmed', query: { status: 'CONFIRMED' } },
  { key: 'to-ship', label: 'To Ship', query: { status: 'PROCESSING' } },
  { key: 'shipped', label: 'Shipped', query: { status: 'SHIPPED' } },
  { key: 'delivered', label: 'Delivered', query: { status: 'DELIVERED' } },
] as const satisfies readonly { key: string; label: string; query: Pick<OrderListQuery, 'status' | 'toPay'> }[];
type TabKey = (typeof TABS)[number]['key'];

export default function OrdersScreen() {
  const { t, money } = useI18n();
  const ready = useRequireAuth('/orders');
  const { tab: initial } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabKey>(TABS.find((x) => x.key === initial)?.key ?? 'all');
  const query = TABS.find((x) => x.key === tab)!.query;
  const { data, isLoading, isFetching, refetch } = useOrdersQuery({ ...query, limit: 50 }, { skip: !ready });
  if (!ready || isLoading) return <Loading />;
  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: t.common.orders }} />
      <UnderlineTabs tabs={TABS.map((x) => ({ key: x.key, label: x.label }))} value={tab} onChange={setTab} />
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyCard icon={<Package size={56} color={colors.muted} />} title="You Haven't Placed Any Orders Yet!" text={tab === 'all' ? undefined : 'No orders in this tab.'} />}
        renderItem={({ item: o }) => (
          <Pressable onPress={() => router.push(`/orders/${o.id}`)} className="gap-2 rounded-xl bg-white p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold">{o.orderNumber}</Text>
              <Badge label={t.status[o.status]} tone={o.status === 'DELIVERED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : 'warning'} />
            </View>
            <View className="flex-row items-center gap-2">
              {o.previewImages.slice(0, 4).map((src) => (
                <Image key={src} source={img(src, 48)} style={{ width: 48, height: 48, borderRadius: 6 }} />
              ))}
              <View className="flex-1 items-end">
                <Text className="text-xs text-ink-500">{o.itemCount} {t.cart.items}</Text>
                <Text className="font-bold text-accent-600">{money(o.total)}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
