import { errorMessage, useCancelOrderMutation, useOrdersQuery } from '@marketbd/api-client';
import { CancelOrderSchema, type OrderSummary } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { PackageX } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { EmptyCard, fmtDate, Sheet, UnderlineTabs } from '@/components/account';
import { Badge, Button, colors, Loading, RadioDot } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { useRequireAuth } from '@/lib/use-require-auth';

const REASONS = ['Changed my mind', 'Found a better price elsewhere', 'Ordered by mistake', 'Delivery takes too long', 'Want to change the address or items'];
const OTHER = 'Other reason';

function OrderCard({ o, onCancel }: { o: OrderSummary; onCancel?: () => void }) {
  const { t, money } = useI18n();
  return (
    <Pressable onPress={() => router.push(`/orders/${o.id}`)} className="gap-2 rounded-xl bg-white p-3">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm font-semibold text-ink-900">{o.orderNumber}</Text>
          <Text className="text-xs text-ink-500">Placed {fmtDate(o.createdAt)}</Text>
        </View>
        <Badge label={t.status[o.status]} tone={o.status === 'CANCELLED' ? 'danger' : 'warning'} />
      </View>
      <View className="flex-row items-center gap-2">
        {o.previewImages.slice(0, 4).map((src) => (
          <Image key={src} source={img(src, 48)} style={{ width: 48, height: 48, borderRadius: 6 }} />
        ))}
        <View className="flex-1 items-end">
          <Text className="text-xs text-ink-500">
            {o.itemCount} {t.cart.items}
          </Text>
          <Text className="font-bold text-accent-600">{money(o.total)}</Text>
        </View>
      </View>
      {onCancel ? <Button title="Cancel order" variant="outline" className="h-10" onPress={onCancel} /> : null}
    </Pressable>
  );
}

function CancelSheet({ order, onClose }: { order: OrderSummary; onClose: () => void }) {
  const [cancel, state] = useCancelOrderMutation();
  const [choice, setChoice] = useState(REASONS[0]!);
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const parsed = CancelOrderSchema.safeParse({ reason: choice === OTHER ? other : choice });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the reason');
    setError(null);
    try {
      await cancel({ id: order.id, ...parsed.data }).unwrap();
      Alert.alert('Order cancelled', order.paymentStatus === 'PAID' ? 'Your refund will be processed shortly.' : undefined);
      onClose();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };
  return (
    <Sheet open title={`Cancel ${order.orderNumber}`} onClose={onClose}>
      <Text className="text-sm text-ink-600">Why do you want to cancel?</Text>
      {[...REASONS, OTHER].map((r) => (
        <Pressable key={r} onPress={() => setChoice(r)} accessibilityRole="radio" accessibilityState={{ checked: choice === r }} className="flex-row items-center gap-3 py-1.5">
          <RadioDot checked={choice === r} />
          <Text className="text-sm text-ink-800">{r}</Text>
        </Pressable>
      ))}
      {choice === OTHER ? (
        <TextInput className="min-h-20 rounded-lg border border-ink-200 bg-white p-3 text-base" multiline textAlignVertical="top" placeholder="Tell us why" value={other} onChangeText={setOther} accessibilityLabel="Your reason" />
      ) : null}
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
      <Button title="Cancel order" variant="danger" onPress={() => void submit()} loading={state.isLoading} />
    </Sheet>
  );
}

/** Cancellations: orders that can still be cancelled (nothing shipped yet) and earlier cancellations. */
export default function CancellationsScreen() {
  const ready = useRequireAuth('/cancellations');
  const [tab, setTab] = useState<'cancel' | 'history'>('cancel');
  const open = useOrdersQuery({ cancellable: true, limit: 50 }, { skip: !ready || tab !== 'cancel' });
  const done = useOrdersQuery({ status: 'CANCELLED', limit: 50 }, { skip: !ready || tab !== 'history' });
  const [cancelling, setCancelling] = useState<OrderSummary | null>(null);
  const q = tab === 'cancel' ? open : done;
  if (!ready) return <Loading />;
  const list = q.data?.items ?? [];

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: 'My Cancellations' }} />
      <UnderlineTabs
        tabs={[
          { key: 'cancel', label: 'Can Cancel' },
          { key: 'history', label: 'Cancelled' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}>
        {q.isLoading ? (
          <Loading />
        ) : list.length === 0 ? (
          <EmptyCard
            icon={<PackageX size={56} color={colors.muted} />}
            title={tab === 'cancel' ? 'No orders to cancel' : 'No cancellations'}
            text={tab === 'cancel' ? 'Once you place an order, you can manage or cancel it before it ships.' : 'Orders you cancel show up here.'}
          />
        ) : (
          list.map((o) => <OrderCard key={o.id} o={o} onCancel={tab === 'cancel' ? () => setCancelling(o) : undefined} />)
        )}
      </ScrollView>
      {cancelling ? <CancelSheet order={cancelling} onClose={() => setCancelling(null)} /> : null}
    </View>
  );
}
