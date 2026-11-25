import { errorMessage, useReportNotReceivedMutation } from '@marketbd/api-client';
import { DeliveryDisputeSchema, type SubOrderView } from '@marketbd/shared';
import { PackageX, Truck } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Sheet } from '@/components/account';
import { Button, colors } from '@/components/ui';

/** Order screen: who delivers a package, its tracking number, and "I didn't receive it". */
export function PackageDelivery({ orderId, sub }: { orderId: string; sub: SubOrderView }) {
  const [report, state] = useReportNotReceivedMutation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ownCourier = sub.fulfillment === 'SELLER';
  const canReport = sub.status === 'DELIVERED' && !sub.dispute;
  if (!ownCourier && !sub.dispute && !canReport) return null;

  const submit = async () => {
    const parsed = DeliveryDisputeSchema.safeParse({ note });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the note');
    setError(null);
    try {
      await report({ orderId, subOrderId: sub.id, note: parsed.data.note }).unwrap();
      Alert.alert('Thanks', 'Our team will check with the courier and get back to you.');
      setOpen(false);
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };

  return (
    <View className="gap-2 border-t border-ink-100 pt-2">
      {ownCourier ? (
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Truck size={14} color={colors.primary} />
          <Text className="text-xs text-ink-600">
            Delivered by the shop with <Text className="font-semibold text-ink-800">{sub.courierName}</Text>
            {sub.trackingNumber ? <Text className="font-mono"> · {sub.trackingNumber}</Text> : null}
          </Text>
        </View>
      ) : null}
      {sub.dispute ? (
        <Text className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
          You reported this package as not received.{' '}
          {sub.dispute.resolution === 'NOT_DELIVERED'
            ? 'We confirmed it was not delivered — your refund is being processed.'
            : sub.dispute.resolution === 'DELIVERED'
              ? 'The courier confirmed the delivery. Contact support if you still need help.'
              : 'Our team is checking with the courier.'}
        </Text>
      ) : canReport ? (
        <Pressable onPress={() => setOpen(true)} className="flex-row items-center gap-1.5 self-start py-1">
          <PackageX size={14} color={colors.muted} />
          <Text className="text-xs text-ink-500">I didn’t receive this package</Text>
        </Pressable>
      ) : null}
      <Sheet open={open} title="Package not received" onClose={() => setOpen(false)}>
        <Text className="text-sm text-ink-600">This package is marked delivered. Tell us what happened and we will check with the courier.</Text>
        <TextInput
          className="min-h-24 rounded-lg border border-ink-200 bg-white p-3 text-base"
          multiline
          textAlignVertical="top"
          placeholder="e.g. No one came to my address"
          value={note}
          onChangeText={setNote}
          accessibilityLabel="What happened"
        />
        {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
        <Button title="Report" onPress={() => void submit()} loading={state.isLoading} />
      </Sheet>
    </View>
  );
}
