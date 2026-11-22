import { selectUser, useAvailableCouponsQuery } from '@marketbd/api-client';
import type { CouponScope } from '@marketbd/shared';
import { router, Stack } from 'expo-router';
import { Ticket, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { EmptyCard, UnderlineTabs, useCollect, VoucherCard } from '@/components/account';
import { colors, Loading } from '@/components/ui';

type Tab = 'ALL' | CouponScope;
const SECTIONS: { scope: CouponScope; tab: string; title: string }[] = [
  { scope: 'PLATFORM', tab: 'MarketBD', title: 'MarketBD Vouchers' },
  { scope: 'STORE', tab: 'Store', title: 'Store Vouchers' },
  { scope: 'PAYMENT', tab: 'Payment', title: 'Payment Vouchers' },
];

/** Voucher Center: every running voucher, grouped by kind, with Collect. */
export default function VoucherCenterScreen() {
  const user = useSelector(selectUser);
  const { data: vouchers = [], isLoading, isFetching, refetch } = useAvailableCouponsQuery(user?.id);
  const { onCollect, busyId } = useCollect('/vouchers');
  const [tab, setTab] = useState<Tab>('ALL');
  if (isLoading) return <Loading />;

  const count = (scope: CouponScope) => vouchers.filter((v) => v.scope === scope).length;
  const tabs = [{ key: 'ALL' as Tab, label: 'All Vouchers', count: vouchers.length }, ...SECTIONS.map((s) => ({ key: s.scope as Tab, label: s.tab, count: count(s.scope) }))];
  const shown = SECTIONS.filter((s) => tab === 'ALL' || s.scope === tab)
    .map((s) => ({ ...s, list: vouchers.filter((v) => v.scope === s.scope) }))
    .filter((s) => s.list.length > 0);

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          title: 'Voucher Center',
          headerRight: user
            ? () => (
                <Pressable onPress={() => router.push('/my-vouchers')} hitSlop={8} className="flex-row items-center gap-1">
                  <Wallet size={18} color="#fff" />
                  <Text className="text-sm font-semibold text-white">My Voucher</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <UnderlineTabs tabs={tabs} value={tab} onChange={setTab} />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 16 }} refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}>
        {shown.length === 0 ? (
          <EmptyCard icon={<Ticket size={48} color={colors.muted} />} title="No vouchers right now" text="New vouchers appear here during sales and campaigns." />
        ) : (
          shown.map((s) => (
            <View key={s.scope} className="gap-3">
              <Text className="text-base font-bold text-ink-900">{s.title}</Text>
              {s.list.map((v) => (
                <VoucherCard key={v.id} v={v} onCollect={() => void onCollect(v.id)} busy={busyId === v.id} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
