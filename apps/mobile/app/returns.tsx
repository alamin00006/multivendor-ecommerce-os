import { errorMessage, useMyReturnsQuery, useRequestReturnMutation, useReturnableOrdersQuery } from '@marketbd/api-client';
import { type MyReturnView, type ReturnableOrder, ReturnRequestSchema, type ReturnStatus } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Check, PackageOpen, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { EmptyCard, fmtDate, Sheet, UnderlineTabs } from '@/components/account';
import { Badge, Button, colors, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { useRequireAuth } from '@/lib/use-require-auth';

type Tab = 'all' | 'initiate' | 'track';
const LABEL: Record<ReturnStatus, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved — send the item back',
  REJECTED: 'Rejected',
  RECEIVED: 'Item received',
  REFUNDED: 'Refunded',
};
const TONE: Record<ReturnStatus, 'warning' | 'primary' | 'danger' | 'success'> = { REQUESTED: 'warning', APPROVED: 'primary', REJECTED: 'danger', RECEIVED: 'primary', REFUNDED: 'success' };
const STEPS: { status: ReturnStatus; label: string }[] = [
  { status: 'REQUESTED', label: 'Requested' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'RECEIVED', label: 'Received' },
  { status: 'REFUNDED', label: 'Refunded' },
];
const OPEN: ReturnStatus[] = ['REQUESTED', 'APPROVED', 'RECEIVED'];

function Thumbs({ items }: { items: { title: string; imageUrl: string | null; quantity: number; variantLabel?: string }[] }) {
  return (
    <View className="gap-2">
      {items.map((i, n) => (
        <View key={`${i.title}-${n}`} className="flex-row items-center gap-3">
          <Image source={i.imageUrl ? img(i.imageUrl, 48) : undefined} style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: colors.canvas }} />
          <View className="flex-1">
            <Text numberOfLines={2} className="text-sm text-ink-800">{i.title}</Text>
            <Text className="text-xs text-ink-500">
              {i.variantLabel && i.variantLabel !== 'Default' ? `${i.variantLabel} · ` : ''}Qty {i.quantity}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Requested → Approved → Received → Refunded. */
function Progress({ status }: { status: ReturnStatus }) {
  if (status === 'REJECTED') return null;
  const at = STEPS.findIndex((s) => s.status === status);
  return (
    <View className="flex-row items-start">
      {STEPS.map((s, i) => (
        <View key={s.status} className="flex-1 items-center gap-1">
          <View className="w-full flex-row items-center">
            <View className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : i <= at ? 'bg-primary-600' : 'bg-ink-200'}`} />
            <View className={`size-5 items-center justify-center rounded-full ${i <= at ? 'bg-primary-600' : 'bg-ink-200'}`}>{i <= at ? <Check size={12} color="#fff" /> : null}</View>
            <View className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? 'opacity-0' : i < at ? 'bg-primary-600' : 'bg-ink-200'}`} />
          </View>
          <Text className={`text-[10px] ${i <= at ? 'font-semibold text-primary-700' : 'text-ink-400'}`}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ReturnCard({ r }: { r: MyReturnView }) {
  const { money } = useI18n();
  return (
    <Pressable onPress={() => router.push(`/orders/${r.orderId}`)} className="gap-3 rounded-xl bg-white p-3">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm font-semibold text-ink-900">{r.orderNumber}</Text>
          <Text className="text-xs text-ink-500">
            {r.shopName ? `${r.shopName} · ` : ''}Requested {fmtDate(r.createdAt)}
          </Text>
        </View>
        <Badge label={LABEL[r.status]} tone={TONE[r.status]} />
      </View>
      <Thumbs items={r.items} />
      <Text className="text-xs text-ink-600">Reason: {r.reason}</Text>
      <Progress status={r.status} />
      {r.status === 'REJECTED' ? (
        <View className="flex-row items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
          <X size={14} color={colors.danger} />
          <Text className="flex-1 text-xs text-red-700">This return was rejected{r.sellerNote || r.adminNote ? ` — ${r.sellerNote ?? r.adminNote}` : ''}.</Text>
        </View>
      ) : null}
      {r.status !== 'REJECTED' && r.sellerNote ? <Text className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">Note from the shop: {r.sellerNote}</Text> : null}
      {r.status !== 'REJECTED' && r.adminNote ? <Text className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">Note from MarketBD: {r.adminNote}</Text> : null}
      {r.status === 'REFUNDED' ? <Text className="text-xs font-semibold text-primary-700">Refund of up to {money(r.orderTotal)} issued to your original payment method.</Text> : null}
    </Pressable>
  );
}

function RequestSheet({ order, subOrderId, onClose }: { order: ReturnableOrder; subOrderId: string; onClose: () => void }) {
  const [request, state] = useRequestReturnMutation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pkg = order.packages.find((p) => p.subOrderId === subOrderId);
  const submit = async () => {
    const parsed = ReturnRequestSchema.safeParse({ reason, subOrderId });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form');
    setError(null);
    try {
      await request({ id: order.orderId, ...parsed.data }).unwrap();
      Alert.alert('Return requested', 'The shop will review it soon. Track it under Track Return.');
      onClose();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };
  return (
    <Sheet open title={`Return from ${order.orderNumber}`} onClose={onClose}>
      {pkg ? <Thumbs items={pkg.items} /> : null}
      <Text className="text-sm font-medium text-ink-700">What is wrong with the item?</Text>
      <TextInput
        className="min-h-28 rounded-lg border border-ink-200 bg-white p-3 text-base text-ink-900"
        multiline
        textAlignVertical="top"
        placeholder="e.g. Wrong size delivered, the zip is broken…"
        value={reason}
        onChangeText={setReason}
        accessibilityLabel="Return reason"
      />
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
      <Button title="Submit return request" onPress={() => void submit()} loading={state.isLoading} />
    </Sheet>
  );
}

/** Returns: all requests, delivered orders that can still be returned, and open requests to track. */
export default function ReturnsScreen() {
  const ready = useRequireAuth('/returns');
  const [tab, setTab] = useState<Tab>('all');
  const returns = useMyReturnsQuery({ limit: 50 }, { skip: !ready });
  const returnable = useReturnableOrdersQuery(undefined, { skip: !ready || tab !== 'initiate' });
  const [requesting, setRequesting] = useState<{ order: ReturnableOrder; subOrderId: string } | null>(null);
  if (!ready || returns.isLoading) return <Loading />;

  const all = returns.data?.items ?? [];
  const list = tab === 'track' ? all.filter((r) => OPEN.includes(r.status)) : all;
  const refreshing = tab === 'initiate' ? returnable.isFetching : returns.isFetching;
  const refresh = () => void (tab === 'initiate' ? returnable.refetch() : returns.refetch());

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: 'My Returns' }} />
      <UnderlineTabs
        tabs={[
          { key: 'all', label: 'All Return' },
          { key: 'initiate', label: 'Initiate Return' },
          { key: 'track', label: 'Track Return' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
        {tab === 'initiate' ? (
          returnable.isLoading ? (
            <Loading />
          ) : !returnable.data?.length ? (
            <EmptyCard icon={<PackageOpen size={56} color={colors.muted} />} title="Nothing to return" text="Delivered orders that are still inside the return window show up here." />
          ) : (
            returnable.data.map((o) => (
              <View key={o.orderId} className="gap-3 rounded-xl bg-white p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-ink-900">{o.orderNumber}</Text>
                  {o.returnBy ? <Text className="text-xs text-ink-500">Return by {fmtDate(o.returnBy)}</Text> : null}
                </View>
                {o.packages.map((p) => (
                  <View key={p.subOrderId} className="gap-2 border-t border-ink-100 pt-2">
                    {p.shopName ? <Text className="text-xs font-semibold text-ink-500">{p.shopName}</Text> : null}
                    <Thumbs items={p.items} />
                    <Button title="Return these items" variant="outline" className="h-10" onPress={() => setRequesting({ order: o, subOrderId: p.subOrderId })} />
                  </View>
                ))}
              </View>
            ))
          )
        ) : list.length === 0 ? (
          <EmptyCard
            icon={<PackageOpen size={56} color={colors.muted} />}
            title={tab === 'track' ? 'No returns in progress' : "You haven't returned anything"}
            text={tab === 'track' ? 'Returns waiting for approval, pickup or refund show up here.' : 'You can return delivered items from Initiate Return.'}
          />
        ) : (
          list.map((r) => <ReturnCard key={r.id} r={r} />)
        )}
      </ScrollView>
      {requesting ? <RequestSheet order={requesting.order} subOrderId={requesting.subOrderId} onClose={() => setRequesting(null)} /> : null}
    </View>
  );
}
