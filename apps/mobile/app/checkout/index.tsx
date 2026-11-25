import {
  errorMessage,
  selectUser,
  useAddressesQuery,
  useAvailableCouponsQuery,
  useCheckoutPreviewQuery,
  usePlaceOrderMutation,
  usePublicSettingsQuery,
  useRemoveCartItemMutation,
  useUpdateCartItemMutation,
} from '@marketbd/api-client';
import { BRAND } from '@marketbd/shared';
import type { OnlinePaymentMethod, PaymentMethod } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Banknote, ChevronDown, ChevronRight, ChevronUp, CreditCard, MapPin, Minus, Plus, ShieldCheck, Smartphone, Store, Ticket, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Checkbox, colors, ErrorView, Loading, RadioDot, ScreenHeader } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { openPayment } from '@/lib/payments';
import { useRequireAuth } from '@/lib/use-require-auth';
import { paymentMethodName, voucherAmount, voucherKind } from '@/lib/vouchers';
import { useSelector } from 'react-redux';

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = { COD: Banknote, BKASH: Smartphone, SSLCOMMERZ: CreditCard, CASH: Banknote };
const METHOD_ORDER: OnlinePaymentMethod[] = ['SSLCOMMERZ', 'BKASH', 'COD'];

function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="max-h-[75%] rounded-t-2xl bg-white" style={{ paddingBottom: insets.bottom + 12 }}>
        <View className="flex-row items-center justify-between border-b border-ink-100 px-4 py-3">
          <Text className="text-lg font-bold">{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <X size={22} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

export default function CheckoutScreen() {
  const { t, money, pick } = useI18n();
  const insets = useSafeAreaInsets();
  const ready = useRequireAuth('/checkout');
  const { data: addresses } = useAddressesQuery(undefined, { skip: !ready });
  const { data: settings } = usePublicSettingsQuery();
  const user = useSelector(selectUser);
  const { data: allVouchers = [] } = useAvailableCouponsQuery(user?.id);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | undefined>();
  const [method, setMethod] = useState<OnlinePaymentMethod>('COD');
  const [agreed, setAgreed] = useState(true);
  const [picker, setPicker] = useState(false);
  const [voucherSheet, setVoucherSheet] = useState(false);
  const [breakdown, setBreakdown] = useState(false);
  const selectedId = addressId ?? addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id;
  const address = addresses?.find((a) => a.id === selectedId);
  const { data: preview, isLoading, isError, refetch } = useCheckoutPreviewQuery({ addressId: selectedId, couponCode: coupon, paymentMethod: method }, { skip: !ready });
  const [placeOrder, placing] = usePlaceOrderMutation();
  const [updateItem] = useUpdateCartItemMutation();
  const [removeItem] = useRemoveCartItemMutation();

  if (!ready || isLoading) return <Loading />;
  if (isError || !preview) return <ErrorView message={t.common.error} onRetry={() => void refetch()} />;

  const items = preview.groups.flatMap((g) => g.items);
  // Store vouchers only for shops in this order; collected vouchers first.
  const shopIds = preview.groups.map((g) => g.seller?.id).filter((id): id is string => Boolean(id));
  const vouchers = allVouchers
    .filter((v) => v.scope !== 'STORE' || !v.seller || shopIds.length === 0 || shopIds.includes(v.seller.id))
    .sort((a, b) => Number(b.collected) - Number(a.collected));
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const listSubtotal = items.reduce((s, i) => s + Math.max(i.compareAtPrice ?? i.unitPrice, i.unitPrice) * i.quantity, 0);
  const productDiscount = listSubtotal - preview.subtotal;
  const methods = [...preview.paymentMethods].sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method));
  const eta = preview.shippingZone === 'OUTSIDE_DHAKA' ? settings?.shipping.outsideDhakaEta : settings?.shipping.insideDhakaEta;

  const applyCode = (code: string) => {
    const clean = code.trim().toUpperCase();
    setCouponInput(clean);
    setCoupon(clean || undefined);
  };

  const submit = async () => {
    if (!selectedId) return router.push('/addresses');
    if (!agreed) return Alert.alert('Please accept the terms to place your order');
    try {
      const result = await placeOrder({ addressId: selectedId, paymentMethod: method, couponCode: preview.coupon?.code, client: 'mobile' }).unwrap();
      if (method !== 'COD' && result.payment?.redirectUrl) await openPayment(result.payment.redirectUrl, result.order.id);
      else router.replace({ pathname: '/checkout/result', params: { status: method === 'COD' ? 'success' : 'failed', order: result.order.id } });
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={t.checkout.title} subtitle={`(${itemCount} selected)`} />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 24 }}>
        {/* ── Shipping ── */}
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-semibold text-ink-900">Shipping to</Text>
          {addresses?.length ? (
            <Pressable onPress={() => setPicker(true)} className="flex-row items-center gap-1 rounded-lg bg-primary-50 px-3 py-2">
              <Text className="font-semibold text-primary-800">{t.checkout.change}</Text>
              <ChevronDown size={16} color={colors.primaryDark} />
            </Pressable>
          ) : null}
        </View>
        {address ? (
          <View className="gap-1.5 rounded-xl bg-white p-4">
            <View className="flex-row flex-wrap items-center gap-2">
              <View className="rounded-full bg-green-50 px-2.5 py-0.5">
                <Text className="font-semibold capitalize text-success">{address.label.toLowerCase()}</Text>
              </View>
              <Text className="text-base font-semibold text-ink-900">{address.fullName}</Text>
              <Text className="text-base text-ink-600">{address.phone}</Text>
            </View>
            <Text className="text-sm text-ink-500">{address.addressLine}</Text>
            <Text className="text-base text-ink-900">
              {pick(address.area.name, address.area.nameBn)}, {pick(address.district.name, address.district.nameBn)}.
            </Text>
          </View>
        ) : (
          <Pressable onPress={() => router.push('/addresses')} className="flex-row items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 bg-white py-6">
            <MapPin size={18} color={colors.primary} />
            <Text className="font-semibold text-primary-700">{t.checkout.addAddress}</Text>
          </Pressable>
        )}

        {/* ── Items ── */}
        <Text className="text-xl font-semibold text-ink-900">Order items ({items.length})</Text>
        {preview.groups.map((g, gi) => (
          <View key={g.seller?.id ?? gi} className="overflow-hidden rounded-xl bg-white">
            <View className="flex-row items-center gap-2 border-b border-ink-100 px-3 py-3">
              {g.seller?.logoUrl ? <Image source={img(g.seller.logoUrl, 28)} style={{ width: 28, height: 28, borderRadius: 4 }} /> : <Store size={20} color={colors.primary} />}
              <Text numberOfLines={1} className="flex-shrink text-lg font-medium text-ink-900">{g.seller?.shopName ?? `${t.checkout.package} ${gi + 1}`}</Text>
              {g.seller?.isHouseStore ? (
                <View className="rounded bg-accent-500 px-1.5 py-0.5">
                  <Text className="text-[10px] font-bold uppercase text-white">Official Store</Text>
                </View>
              ) : null}
              <View className="flex-1" />
              <Text className="text-sm text-ink-500">
                {g.items.length} {g.items.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
            {g.items.map((item) => (
              <View key={item.id} className="flex-row gap-3 border-b border-ink-100 p-3">
                <Image source={img(item.product.imageUrl, 80)} style={{ width: 80, height: 80, borderRadius: 8 }} contentFit="cover" />
                <View className="flex-1 gap-1.5">
                  <Text numberOfLines={2} className="text-base leading-5 text-ink-900">{pick(item.product.title, item.product.titleBn)}</Text>
                  {Object.values(item.variant.attributes).length ? (
                    <View className="self-start rounded-full bg-ink-50 px-3 py-1">
                      <Text className="text-sm text-ink-800">{Object.values(item.variant.attributes).join(', ')}</Text>
                    </View>
                  ) : null}
                  {g.seller ? <Text className="text-sm text-accent-600">{g.seller.isHouseStore ? `Fulfilled by ${BRAND.name}` : `Sold by ${g.seller.shopName}`}</Text> : null}
                  <View className="flex-row items-center justify-between">
                    <View className="h-9 flex-row items-center overflow-hidden rounded-md border border-ink-200">
                      <Pressable
                        className="h-full w-9 items-center justify-center"
                        onPress={() => (item.quantity <= 1 ? void removeItem(item.id) : void updateItem({ id: item.id, quantity: item.quantity - 1 }))}
                        accessibilityLabel={item.quantity <= 1 ? 'Remove' : 'Decrease'}
                      >
                        {item.quantity <= 1 ? <Trash2 size={16} color={colors.warning} /> : <Minus size={16} color={colors.ink} />}
                      </Pressable>
                      <Text className="w-9 border-x border-ink-200 text-center leading-9">{item.quantity}</Text>
                      <Pressable
                        className="h-full w-9 items-center justify-center"
                        disabled={item.quantity >= Math.min(item.variant.stock, 20)}
                        onPress={() => void updateItem({ id: item.id, quantity: item.quantity + 1 })}
                        accessibilityLabel="Increase"
                      >
                        <Plus size={16} color={colors.accent} />
                      </Pressable>
                    </View>
                    <View className="flex-row items-baseline gap-1.5">
                      {item.compareAtPrice && item.compareAtPrice > item.unitPrice ? (
                        <Text className="text-sm text-ink-400 line-through">{money(item.compareAtPrice * item.quantity)}</Text>
                      ) : null}
                      <Text className="text-lg font-bold text-accent-600">{money(item.lineTotal)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
            <View className="flex-row items-center justify-between px-3 py-3">
              <View>
                <Text className="text-base font-medium text-ink-900">{g.delivery.by === 'SHOP' ? `Shop delivery · ${g.delivery.courier}` : 'Standard Delivery'}</Text>
                {g.delivery.eta ?? eta ? (
                  <Text className="text-sm text-ink-500">
                    Receive within <Text className="text-primary-700">{g.delivery.eta ?? eta}</Text>
                  </Text>
                ) : null}
              </View>
              <Text className="font-semibold text-success">{selectedId ? `Fee ${money(g.shippingFee)}` : 'Add address'}</Text>
            </View>
          </View>
        ))}

        {/* ── Voucher code ── */}
        <View className="flex-row items-center rounded-xl border border-ink-300 bg-white pl-4">
          <TextInput
            className="h-14 flex-1 text-base"
            placeholder="Enter voucher code"
            autoCapitalize="characters"
            value={couponInput}
            onChangeText={setCouponInput}
            onSubmitEditing={() => applyCode(couponInput)}
          />
          <Pressable onPress={() => applyCode(couponInput)} className="px-4 py-3">
            <Text className="text-lg font-semibold text-accent-600">{t.checkout.applyCoupon}</Text>
          </Pressable>
        </View>
        {preview.couponError ? <Text className="-mt-1 text-sm text-danger">{preview.couponError}</Text> : null}
        {preview.coupon ? (
          <View className="-mt-1 flex-row items-center justify-between">
            <Text className="text-sm text-success">✓ {preview.coupon.code} applied</Text>
            <Pressable onPress={() => applyCode('')}>
              <Text className="text-sm text-ink-500">Remove</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Payment ── */}
        <Text className="text-xl font-semibold text-ink-900">Select payment method</Text>
        <View className="rounded-xl bg-white px-4">
          {methods.map(({ method: m, enabled, note }, i) => {
            const Icon = METHOD_ICON[m];
            return (
              <Pressable
                key={m}
                disabled={!enabled}
                onPress={() => setMethod(m)}
                className={`flex-row items-center gap-4 py-4 ${i ? 'border-t border-ink-100' : ''} ${enabled ? '' : 'opacity-50'}`}
              >
                <RadioDot checked={method === m} />
                <Icon size={26} color={colors.accent} />
                <View className="flex-1">
                  <Text className="text-lg font-medium text-ink-900">{t.checkout.methods[m]}</Text>
                  {!enabled ? <Text className="text-sm text-ink-500">{note ?? t.checkout.unavailableMethod}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View className="flex-row items-center gap-2">
          <ShieldCheck size={20} color={colors.primary} fill="#dcfce7" />
          <Text className="font-semibold text-success">{BRAND.name} protects your payment information</Text>
        </View>
        {preview.blockedItems > 0 ? <Text className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t.cart.blocked}</Text> : null}
      </ScrollView>

      {/* ── Sticky footer ── */}
      <View className="bg-white" style={{ paddingBottom: insets.bottom + 8 }}>
        <View className="flex-row items-start gap-3 border-t border-ink-100 px-4 py-3">
          <Checkbox checked={agreed} onPress={() => setAgreed(!agreed)} label="Accept terms" />
          <Text className="flex-1 text-sm text-ink-600">
            I agree to the <Text className="text-info">Terms & Conditions</Text>, <Text className="text-info">Privacy Policy</Text>, and{' '}
            <Text className="text-info">Return & Refund Policy</Text> of {BRAND.name}.
          </Text>
        </View>
        {vouchers.length ? (
          <Pressable onPress={() => setVoucherSheet(true)} className="flex-row items-center justify-between bg-amber-50 px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Ticket size={20} color="#b45309" />
              <Text className="text-lg font-semibold text-amber-700">Vouchers</Text>
              <ChevronRight size={18} color="#b45309" />
            </View>
            <Text className="text-amber-700">{preview.discount > 0 ? `Saved ${money(preview.discount)}` : `${vouchers.length} available`}</Text>
          </Pressable>
        ) : null}
        {breakdown ? (
          <View className="gap-1.5 border-t border-ink-100 px-4 pt-3">
            <View className="flex-row justify-between">
              <Text className="text-ink-600">Product subtotal</Text>
              <Text>{money(listSubtotal)}</Text>
            </View>
            {productDiscount > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-ink-600">Product discount</Text>
                <Text className="text-accent-600">-{money(productDiscount)}</Text>
              </View>
            ) : null}
            <View className="flex-row justify-between">
              <Text className="text-ink-600">Delivery fee</Text>
              <Text>{money(preview.shippingFee)}</Text>
            </View>
            {preview.discount > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-ink-600">{preview.coupon?.appliesTo === 'shipping' ? 'Delivery discount' : 'Voucher'}</Text>
                <Text className="text-accent-600">-{money(preview.discount)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <View className="flex-row items-center gap-3 px-4 pt-3">
          <Pressable onPress={() => setBreakdown(!breakdown)} className="flex-1">
            <Text className="text-sm text-ink-700">Total:</Text>
            <View className="flex-row items-center gap-1.5">
              <Text className="text-2xl font-bold text-accent-600">{money(preview.total)}</Text>
              <View className="size-6 items-center justify-center rounded-full bg-accent-50">
                {breakdown ? <ChevronDown size={16} color={colors.accent} /> : <ChevronUp size={16} color={colors.accent} />}
              </View>
            </View>
          </Pressable>
          <Pressable
            disabled={placing.isLoading || preview.groups.length === 0 || preview.blockedItems > 0 || !agreed}
            onPress={() => void submit()}
            className={`h-14 min-w-44 items-center justify-center rounded-xl bg-accent-500 px-5 ${placing.isLoading || preview.groups.length === 0 || preview.blockedItems > 0 || !agreed ? 'opacity-50' : ''}`}
          >
            {placing.isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-lg font-semibold text-white">{method === 'COD' ? `Place Order (${itemCount})` : `Order & Pay (${itemCount})`}</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Sheet open={picker} title="Shipping address" onClose={() => setPicker(false)}>
        {addresses?.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              setAddressId(a.id);
              setPicker(false);
            }}
            className={`flex-row gap-3 rounded-xl border-2 p-3 ${a.id === selectedId ? 'border-primary-600 bg-primary-50' : 'border-ink-100'}`}
          >
            <RadioDot checked={a.id === selectedId} />
            <View className="flex-1">
              <Text className="font-semibold text-ink-900">
                {a.fullName} · {a.phone}
              </Text>
              <Text className="text-sm text-ink-600">
                {a.addressLine}, {pick(a.area.name, a.area.nameBn)}, {pick(a.district.name, a.district.nameBn)}
              </Text>
            </View>
          </Pressable>
        ))}
        <Pressable
          onPress={() => {
            setPicker(false);
            router.push('/addresses');
          }}
          className="items-center rounded-xl border border-primary-600 py-3"
        >
          <Text className="font-semibold text-primary-700">+ {t.checkout.addAddress}</Text>
        </Pressable>
      </Sheet>

      <Sheet open={voucherSheet} title="Vouchers" onClose={() => setVoucherSheet(false)}>
        {vouchers.map((v) => {
          const base = v.scope === 'STORE' ? (preview.groups.find((g) => g.seller?.id === v.seller?.id)?.subtotal ?? 0) : preview.subtotal;
          const reason =
            base < v.minOrderAmount
              ? `Add ${money(v.minOrderAmount - base)} more`
              : v.scope === 'PAYMENT' && v.paymentMethod && v.paymentMethod !== method
                ? `Pay with ${paymentMethodName(v.paymentMethod)}`
                : null;
          const short = Boolean(reason);
          const applied = preview.coupon?.code === v.code;
          return (
            <View key={v.id} className="flex-row items-center gap-3 rounded-xl border-2 border-accent-300 bg-accent-50 p-3">
              <Ticket size={26} color={colors.accent} />
              <View className="flex-1">
                <Text numberOfLines={1} className="text-xs font-semibold text-ink-600">
                  {voucherKind(v)}
                  {v.collected ? ' · Collected' : ''}
                </Text>
                <Text className="text-lg font-bold text-accent-700">{voucherAmount(v, money)}</Text>
                <Text className="text-xs text-ink-500">
                  Min. spend {money(v.minOrderAmount)}
                  {reason ? ` · ${reason}` : ''}
                </Text>
              </View>
              <Pressable
                disabled={short}
                onPress={() => {
                  applyCode(applied ? '' : v.code);
                  setVoucherSheet(false);
                }}
                className={`rounded-lg px-4 py-2 ${applied ? 'bg-white' : 'bg-accent-500'} ${short ? 'opacity-40' : ''}`}
              >
                <Text className={`font-semibold ${applied ? 'text-accent-600' : 'text-white'}`}>{applied ? 'Remove' : 'Apply'}</Text>
              </Pressable>
            </View>
          );
        })}
      </Sheet>
    </View>
  );
}
