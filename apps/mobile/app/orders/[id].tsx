import {
  errorMessage,
  useCancelOrderMutation,
  useCreateReviewMutation,
  useInitiatePaymentMutation,
  useMarketplaceMode,
  useOrderQuery,
  useRequestReturnMutation,
} from '@marketbd/api-client';
import type { OrderItemView } from '@marketbd/shared';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Circle, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Badge, Button, Card, colors, ErrorView, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { openPayment } from '@/lib/payments';

const FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, money } = useI18n();
  const { showSellerInfo } = useMarketplaceMode();
  const { data: order, isLoading, isError, isFetching, refetch } = useOrderQuery(id);
  const [cancel, cancelState] = useCancelOrderMutation();
  const [requestReturn, returnState] = useRequestReturnMutation();
  const [pay, payState] = useInitiatePaymentMutation();
  const [createReview, reviewState] = useCreateReviewMutation();
  const [dialog, setDialog] = useState<'cancel' | 'return' | null>(null);
  const [reason, setReason] = useState('');
  const [reviewing, setReviewing] = useState<OrderItemView | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  if (isError) return <ErrorView message={t.common.error} onRetry={() => void refetch()} />;
  if (isLoading || !order) return <Loading />;
  const reached = FLOW.indexOf(order.status as (typeof FLOW)[number]);

  const submitDialog = async () => {
    try {
      if (dialog === 'cancel') await cancel({ id, reason }).unwrap();
      else await requestReturn({ id, reason }).unwrap();
      setDialog(null);
      setReason('');
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }} refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}>
      <Stack.Screen options={{ title: order.orderNumber }} />
      <Card className="gap-3">
        <View className="flex-row items-center justify-between">
          <Badge label={t.status[order.status]} tone="primary" />
          <Badge label={t.payStatus[order.paymentStatus]} />
        </View>
        {reached >= 0 ? (
          <View className="flex-row items-center">
            {FLOW.map((s, i) => (
              <View key={s} className="flex-1 items-center gap-1">
                {i <= reached ? <CheckCircle2 size={20} color={colors.primary} /> : <Circle size={20} color={colors.border} />}
                <Text className={`text-center text-[9px] ${i <= reached ? 'font-semibold text-primary-800' : 'text-ink-400'}`}>{t.status[s]}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          {order.canPay ? (
            <Button
              title={t.account.payNow}
              variant="accent"
              loading={payState.isLoading}
              onPress={async () => {
                try {
                  const r = await pay({ orderId: order.id, client: 'mobile' }).unwrap();
                  if (r.redirectUrl) await openPayment(r.redirectUrl, order.id);
                } catch (e) {
                  Alert.alert(errorMessage(e));
                }
              }}
            />
          ) : null}
          {order.canCancel ? <Button title={t.account.cancelOrder} variant="outline" onPress={() => setDialog('cancel')} /> : null}
          {order.canReturn ? <Button title={t.account.requestReturn} variant="outline" onPress={() => setDialog('return')} /> : null}
        </View>
      </Card>

      {order.subOrders.map((sub, i) => (
        <Card key={sub.id} className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold">
              {t.checkout.package} {i + 1}
              {showSellerInfo && sub.seller ? <Text className="font-normal text-ink-500"> · {sub.seller.shopName}</Text> : null}
            </Text>
            <Badge label={t.status[sub.status]} />
          </View>
          {sub.items.map((item) => (
            <View key={item.id} className="flex-row gap-3">
              <Image source={img(item.imageUrl, 56)} style={{ width: 56, height: 56, borderRadius: 6 }} />
              <View className="flex-1">
                <Text numberOfLines={1} className="text-sm">{item.title}</Text>
                <Text className="text-xs text-ink-500">{item.variantLabel}</Text>
                <Text className="text-xs">{money(item.unitPrice)} × {item.quantity}</Text>
                {sub.status === 'DELIVERED' && !item.reviewed ? (
                  <Pressable onPress={() => setReviewing(item)}>
                    <Text className="mt-1 text-xs font-semibold text-primary-700">{t.account.writeReview}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      ))}

      <Card className="gap-1">
        <Text className="font-semibold">{t.checkout.shippingAddress}</Text>
        <Text className="text-sm">{order.shippingAddress.fullName} · {order.shippingAddress.phone}</Text>
        <Text className="text-sm text-ink-600">{order.shippingAddress.addressLine}, {order.shippingAddress.area}, {order.shippingAddress.district}</Text>
      </Card>

      <Card className="gap-1">
        <View className="flex-row justify-between"><Text className="text-ink-500">{t.cart.subtotal}</Text><Text>{money(order.subtotal)}</Text></View>
        <View className="flex-row justify-between"><Text className="text-ink-500">{t.cart.shipping}</Text><Text>{money(order.shippingFee)}</Text></View>
        {order.discount > 0 ? <View className="flex-row justify-between"><Text className="text-green-700">{t.cart.discount}</Text><Text className="text-green-700">-{money(order.discount)}</Text></View> : null}
        <View className="flex-row justify-between border-t border-ink-100 pt-1"><Text className="font-semibold">{t.cart.total}</Text><Text className="font-bold text-accent-600">{money(order.total)}</Text></View>
        <Text className="text-xs text-ink-500">{t.checkout.methods[order.paymentMethod]}</Text>
      </Card>

      <Card className="gap-2">
        <Text className="font-semibold">{t.account.timeline}</Text>
        {[...order.history].reverse().map((e, i) => (
          <View key={`${e.createdAt}-${i}`} className="border-l-2 border-ink-100 pl-3">
            <Text className="text-sm font-medium">{t.status[e.status]}</Text>
            <Text className="text-xs text-ink-500">{new Date(e.createdAt).toLocaleString()}{e.note ? ` · ${e.note}` : ''}</Text>
          </View>
        ))}
      </Card>

      <Modal visible={dialog !== null} transparent animationType="slide" onRequestClose={() => setDialog(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="gap-3 rounded-t-2xl bg-white p-5 pb-10">
            <Text className="text-lg font-semibold">{dialog === 'cancel' ? t.account.cancelOrder : t.account.requestReturn}</Text>
            <TextInput className="h-28 rounded-lg border border-ink-200 p-3" multiline textAlignVertical="top" placeholder={dialog === 'cancel' ? t.account.cancelReason : t.account.returnReason} value={reason} onChangeText={setReason} />
            <Button title={t.common.apply} variant={dialog === 'cancel' ? 'danger' : 'primary'} disabled={reason.trim().length < (dialog === 'cancel' ? 3 : 10)} loading={cancelState.isLoading || returnState.isLoading} onPress={() => void submitDialog()} />
            <Button title={t.common.close} variant="ghost" onPress={() => setDialog(null)} />
          </View>
        </View>
      </Modal>

      <Modal visible={reviewing !== null} transparent animationType="slide" onRequestClose={() => setReviewing(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="gap-3 rounded-t-2xl bg-white p-5 pb-10">
            <Text className="text-lg font-semibold">{t.account.writeReview}</Text>
            <Text numberOfLines={2} className="text-sm text-ink-600">{reviewing?.title}</Text>
            <View className="flex-row gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)}>
                  <Star size={32} color={colors.warning} fill={n <= rating ? colors.warning : 'transparent'} />
                </Pressable>
              ))}
            </View>
            <TextInput className="h-24 rounded-lg border border-ink-200 p-3" multiline textAlignVertical="top" placeholder={t.account.yourReview} value={comment} onChangeText={setComment} />
            <Button
              title={t.account.submitReview}
              loading={reviewState.isLoading}
              onPress={async () => {
                if (!reviewing) return;
                try {
                  await createReview({ productId: reviewing.productId, rating, comment: comment || undefined }).unwrap();
                  setReviewing(null);
                  setComment('');
                } catch (e) {
                  Alert.alert(errorMessage(e));
                }
              }}
            />
            <Button title={t.common.close} variant="ghost" onPress={() => setReviewing(null)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
