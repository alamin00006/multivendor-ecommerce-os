import {
  errorMessage,
  useAddressesQuery,
  useCheckoutPreviewQuery,
  usePlaceOrderMutation,
} from '@marketbd/api-client';
import type { PaymentMethod } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, colors, ErrorView, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { openPayment } from '@/lib/payments';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function CheckoutScreen() {
  const { t, money, pick } = useI18n();
  const ready = useRequireAuth('/checkout');
  const { data: addresses } = useAddressesQuery(undefined, { skip: !ready });
  const [addressId, setAddressId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | undefined>();
  const [method, setMethod] = useState<PaymentMethod>('COD');
  const selectedId = addressId ?? addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id;
  const address = addresses?.find((a) => a.id === selectedId);
  const { data: preview, isLoading, isError, refetch } = useCheckoutPreviewQuery({ addressId: selectedId, couponCode: coupon }, { skip: !ready });
  const [placeOrder, placing] = usePlaceOrderMutation();

  if (!ready || isLoading) return <Loading />;
  if (isError || !preview) return <ErrorView message={t.common.error} onRetry={() => void refetch()} />;

  const submit = async () => {
    if (!selectedId) return router.push('/addresses');
    try {
      const result = await placeOrder({ addressId: selectedId, paymentMethod: method, couponCode: preview.coupon?.code, client: 'mobile' }).unwrap();
      if (method !== 'COD' && result.payment?.redirectUrl) await openPayment(result.payment.redirectUrl, result.order.id);
      else router.replace({ pathname: '/checkout/result', params: { status: method === 'COD' ? 'success' : 'failed', order: result.order.id } });
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: t.checkout.title }} />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 120 }}>
        <Card className="gap-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <MapPin size={18} color={colors.primary} />
              <Text className="font-semibold">{t.checkout.shippingAddress}</Text>
            </View>
            <Pressable onPress={() => router.push('/addresses')}>
              <Text className="text-sm font-semibold text-primary-700">{address ? t.checkout.change : t.checkout.addAddress}</Text>
            </Pressable>
          </View>
          {address ? (
            <>
              <Text className="text-sm font-semibold">{address.fullName} · {address.phone}</Text>
              <Text className="text-sm text-ink-600">{address.addressLine}, {pick(address.area.name, address.area.nameBn)}, {pick(address.district.name, address.district.nameBn)}</Text>
              {addresses && addresses.length > 1 ? (
                <View className="flex-row flex-wrap gap-2 pt-1">
                  {addresses.map((a) => (
                    <Pressable key={a.id} onPress={() => setAddressId(a.id)} className={`rounded-full border px-3 py-1 ${a.id === selectedId ? 'border-primary-700 bg-primary-50' : 'border-ink-200'}`}>
                      <Text className="text-xs">{a.label} · {a.area.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text className="text-sm text-amber-700">{t.checkout.noAddress}</Text>
          )}
        </Card>

        {preview.groups.map((g, i) => (
          <Card key={g.seller?.id ?? i} className="gap-2">
            <Text className="text-sm font-semibold">
              {t.checkout.package} {i + 1}/{preview.groups.length}
              {g.seller ? <Text className="font-normal text-ink-500"> · {g.seller.shopName}</Text> : null}
            </Text>
            {g.items.map((item) => (
              <View key={item.id} className="flex-row gap-3">
                <Image source={img(item.product.imageUrl, 56)} style={{ width: 56, height: 56, borderRadius: 6 }} />
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-sm">{pick(item.product.title, item.product.titleBn)}</Text>
                  <Text className="text-xs text-ink-500">{Object.values(item.variant.attributes).join(' / ')}</Text>
                  <Text className="text-sm"><Text className="font-semibold text-accent-600">{money(item.unitPrice)}</Text> × {item.quantity}</Text>
                </View>
              </View>
            ))}
            <Text className="text-right text-xs text-ink-500">{t.cart.shipping}: {money(g.shippingFee)}</Text>
          </Card>
        ))}

        <Card className="gap-2">
          <Text className="font-semibold">{t.checkout.payment}</Text>
          {preview.paymentMethods.map(({ method: m, enabled }) => (
            <Pressable key={m} disabled={!enabled} onPress={() => setMethod(m)} className={`flex-row items-center gap-3 rounded-lg border-2 p-3 ${method === m ? 'border-primary-700 bg-primary-50' : 'border-ink-100'} ${enabled ? '' : 'opacity-50'}`}>
              <View className={`size-4 rounded-full border-2 ${method === m ? 'border-primary-700 bg-primary-700' : 'border-ink-300'}`} />
              <Text className="flex-1 text-sm font-semibold">{t.checkout.methods[m]}</Text>
              {!enabled ? <Text className="text-[10px] text-ink-500">{t.checkout.unavailableMethod}</Text> : null}
            </Pressable>
          ))}
        </Card>

        <Card className="gap-2">
          <View className="flex-row gap-2">
            <TextInput className="h-11 flex-1 rounded-lg border border-ink-200 px-3 uppercase" placeholder={t.checkout.coupon} autoCapitalize="characters" value={couponInput} onChangeText={setCouponInput} />
            <Button title={t.checkout.applyCoupon} variant="outline" onPress={() => setCoupon(couponInput.trim().toUpperCase() || undefined)} />
          </View>
          {preview.couponError ? <Text className="text-xs text-red-600">{preview.couponError}</Text> : null}
          {preview.coupon ? <Text className="text-xs text-green-700">✓ {preview.coupon.code}</Text> : null}
          <View className="flex-row justify-between"><Text className="text-ink-500">{t.cart.subtotal}</Text><Text>{money(preview.subtotal)}</Text></View>
          <View className="flex-row justify-between"><Text className="text-ink-500">{t.cart.shipping}</Text><Text>{money(preview.shippingFee)}</Text></View>
          {preview.discount > 0 ? <View className="flex-row justify-between"><Text className="text-green-700">{t.cart.discount}</Text><Text className="text-green-700">-{money(preview.discount)}</Text></View> : null}
          {preview.blockedItems > 0 ? <Text className="rounded bg-amber-50 p-2 text-xs text-amber-800">{t.cart.blocked}</Text> : null}
        </Card>
      </ScrollView>
      <View className="absolute inset-x-0 bottom-0 flex-row items-center gap-3 border-t border-ink-100 bg-white p-3 pb-6">
        <View className="flex-1">
          <Text className="text-xs text-ink-500">{t.cart.total}</Text>
          <Text className="text-lg font-bold text-accent-600">{money(preview.total)}</Text>
        </View>
        <Button
          title={placing.isLoading ? t.checkout.placing : t.checkout.placeOrder}
          variant="accent"
          loading={placing.isLoading}
          disabled={preview.groups.length === 0 || preview.blockedItems > 0}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}
