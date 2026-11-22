import { selectUser, useAvailableCouponsQuery, useMyVouchersQuery } from '@marketbd/api-client';
import type { CouponView } from '@marketbd/shared';
import { router, Stack } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { EmptyCard, fmtDate, UnderlineTabs, useCollect, VoucherCard } from '@/components/account';
import { colors, Loading } from '@/components/ui';
import { useRequireAuth } from '@/lib/use-require-auth';

type Tab = 'recent' | 'expiring' | 'store';
const EXPIRING_WITHIN_MS = 7 * 86_400_000;
const EMPTY: Record<Tab, { title: string; text: string }> = {
  recent: { title: 'No vouchers collected yet', text: 'Collect vouchers from the Voucher Center or product pages to use them at checkout.' },
  expiring: { title: 'Nothing expiring soon', text: 'Vouchers ending within 7 days show up here.' },
  store: { title: 'No store vouchers collected', text: 'Shop vouchers you collect from stores and product pages show up here.' },
};

/** My Voucher: collected vouchers, ones about to expire, and shop vouchers. */
export default function MyVouchersScreen() {
  const ready = useRequireAuth('/my-vouchers');
  const user = useSelector(selectUser);
  const { data: mine = [], isLoading, isFetching, refetch } = useMyVouchersQuery(undefined, { skip: !ready });
  const { data: running = [] } = useAvailableCouponsQuery(user?.id, { skip: !ready });
  const { onCollect, busyId } = useCollect('/my-vouchers');
  const [tab, setTab] = useState<Tab>('recent');
  const [now] = useState(() => Date.now());
  if (!ready || isLoading) return <Loading />;

  const usable = mine.filter((v) => v.status === 'AVAILABLE');
  const lists: Record<Tab, CouponView[]> = {
    recent: usable,
    expiring: running.filter((v) => new Date(v.endsAt).getTime() - now <= EXPIRING_WITHIN_MS).sort((a, b) => a.endsAt.localeCompare(b.endsAt)),
    store: usable.filter((v) => v.scope === 'STORE'),
  };
  const list = lists[tab];

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: 'My Voucher' }} />
      <UnderlineTabs
        tabs={[
          { key: 'recent', label: 'Recently Collected' },
          { key: 'expiring', label: 'Expiring' },
          { key: 'store', label: 'Store' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }} refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}>
        {list.length === 0 ? (
          <>
            <EmptyCard icon={<Ticket size={48} color={colors.muted} />} title={EMPTY[tab].title} text={EMPTY[tab].text} shop={false} />
            <Pressable onPress={() => router.push('/vouchers')} className="items-center">
              <Text className="font-semibold text-primary-700">Go to Voucher Center</Text>
            </Pressable>
          </>
        ) : (
          list.map((v) => (
            <VoucherCard
              key={v.id}
              v={v}
              onCollect={() => void onCollect(v.id)}
              busy={busyId === v.id}
              note={tab === 'expiring' ? `Ends ${fmtDate(v.endsAt)}` : undefined}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
