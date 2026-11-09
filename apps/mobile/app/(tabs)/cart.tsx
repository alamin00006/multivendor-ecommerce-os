import {
  guestItemRemoved,
  guestItemUpdated,
  selectGuestCart,
  useCartQuery,
  useClearUnavailableMutation,
  useIsAuthenticated,
  useRemoveCartItemMutation,
  useUpdateCartItemMutation,
} from '@marketbd/api-client';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ShoppingCart, Trash2 } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Badge, Button, colors, Empty, Loading, Price, Stepper } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';

interface Line {
  key: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  variantLabel: string;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  stock: number;
  selected: boolean;
  available: boolean;
  reason: string | null;
}

export default function CartScreen() {
  const { t, money, pick } = useI18n();
  const dispatch = useDispatch();
  const authed = useIsAuthenticated();
  const guest = useSelector(selectGuestCart);
  const { data, isLoading, isFetching, refetch } = useCartQuery(undefined, { skip: !authed });
  const [update] = useUpdateCartItemMutation();
  const [remove] = useRemoveCartItemMutation();
  const [clearUnavailable] = useClearUnavailableMutation();

  const lines: Line[] = authed
    ? (data?.items ?? []).map((i) => ({
        key: i.id,
        slug: i.product.slug,
        title: pick(i.product.title, i.product.titleBn),
        imageUrl: i.product.imageUrl,
        variantLabel: Object.values(i.variant.attributes).join(' / '),
        unitPrice: i.unitPrice,
        compareAtPrice: i.compareAtPrice,
        quantity: i.quantity,
        stock: i.variant.stock,
        selected: i.selected,
        available: i.available,
        reason: i.unavailableReason,
      }))
    : guest.map((g) => ({
        key: g.variantId,
        slug: g.slug,
        title: pick(g.title, g.titleBn),
        imageUrl: g.imageUrl,
        variantLabel: g.variantLabel,
        unitPrice: g.unitPrice,
        compareAtPrice: g.compareAtPrice,
        quantity: g.quantity,
        stock: g.stock,
        selected: g.selected,
        available: true,
        reason: null,
      }));
  const payable = lines.filter((l) => l.selected && l.available);
  const subtotal = authed ? (data?.summary.subtotal ?? 0) : payable.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const count = payable.reduce((n, l) => n + l.quantity, 0);
  const unavailable = lines.some((l) => !l.available);

  if (authed && isLoading) return <Loading />;
  if (lines.length === 0) {
    return (
      <Empty
        icon={<ShoppingCart size={56} color={colors.muted} />}
        title={t.cart.empty}
        text={t.cart.emptyHint}
        action={<Button title={t.checkout.continueShopping} onPress={() => router.push('/')} />}
      />
    );
  }

  return (
    <View className="flex-1">
      <FlatList
        data={lines}
        keyExtractor={(l) => l.key}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        refreshControl={authed ? <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} /> : undefined}
        ListHeaderComponent={
          unavailable ? (
            <Pressable onPress={() => void clearUnavailable()} className="mb-1 rounded-lg bg-amber-50 p-3">
              <Text className="text-xs text-amber-800">{t.cart.blocked} · {t.cart.removeUnavailable}</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item: l }) => (
          <View className={`flex-row gap-3 rounded-xl bg-white p-3 ${l.available ? '' : 'opacity-60'}`}>
            <Pressable
              onPress={() => (authed ? void update({ id: l.key, selected: !l.selected }) : dispatch(guestItemUpdated({ variantId: l.key, selected: !l.selected })))}
              disabled={!l.available}
              className={`mt-8 size-5 items-center justify-center rounded border ${l.selected && l.available ? 'border-primary-700 bg-primary-700' : 'border-ink-300'}`}
              accessibilityLabel="Select"
            >
              {l.selected && l.available ? <Text className="text-xs text-white">✓</Text> : null}
            </Pressable>
            <Pressable onPress={() => router.push(`/product/${l.slug}`)}>
              <Image source={img(l.imageUrl, 80)} style={{ width: 80, height: 80, borderRadius: 8 }} />
            </Pressable>
            <View className="flex-1 gap-1">
              <Text numberOfLines={2} className="text-sm text-ink-800">{l.title}</Text>
              <Text className="text-xs text-ink-500">{l.variantLabel}</Text>
              {l.reason ? <Badge label={l.reason} tone="danger" /> : null}
              <Price value={l.unitPrice} compareAt={l.compareAtPrice} />
              <View className="flex-row items-center justify-between">
                <Stepper
                  value={l.quantity}
                  max={Math.max(1, Math.min(l.stock, 20))}
                  onChange={(q) => (authed ? void update({ id: l.key, quantity: q }) : dispatch(guestItemUpdated({ variantId: l.key, quantity: q })))}
                />
                <Pressable onPress={() => (authed ? void remove(l.key) : dispatch(guestItemRemoved(l.key)))} accessibilityLabel={t.cart.remove} className="p-2">
                  <Trash2 size={18} color={colors.muted} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
      <View className="flex-row items-center gap-3 border-t border-ink-100 bg-white p-3">
        <View className="flex-1">
          <Text className="text-xs text-ink-500">{t.cart.total} ({count})</Text>
          <Text className="text-lg font-bold text-accent-600">{money(subtotal)}</Text>
        </View>
        <Button
          title={authed ? t.cart.checkout : t.common.signIn}
          variant="accent"
          disabled={authed && count === 0}
          onPress={() => router.push(authed ? '/checkout' : { pathname: '/login', params: { next: '/checkout' } })}
        />
      </View>
    </View>
  );
}
