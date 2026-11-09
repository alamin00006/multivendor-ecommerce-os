import { useOrdersQuery } from '@marketbd/api-client';
import type { OrderStatus } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Package } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Badge, colors, Empty, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { useRequireAuth } from '@/lib/use-require-auth';

const TABS: (OrderStatus | undefined)[] = [undefined, 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export default function OrdersScreen() {
  const { t, money } = useI18n();
  const ready = useRequireAuth('/orders');
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const { data, isLoading, isFetching, refetch } = useOrdersQuery({ status, limit: 50 }, { skip: !ready });
  if (!ready || isLoading) return <Loading />;
  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: t.common.orders }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0 bg-white" contentContainerStyle={{ gap: 6, padding: 8 }}>
        {TABS.map((s) => (
          <Pressable key={s ?? 'all'} onPress={() => setStatus(s)} className={`rounded-full px-3 py-1.5 ${status === s ? 'bg-primary-700' : 'bg-ink-100'}`}>
            <Text className={`text-xs ${status === s ? 'font-semibold text-white' : 'text-ink-700'}`}>{s ? t.status[s] : t.common.seeAll}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={<Empty icon={<Package size={48} color={colors.muted} />} title={t.account.noOrders} />}
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
