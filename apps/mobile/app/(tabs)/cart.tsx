import {
  guestAllSelected,
  guestItemRemoved,
  guestItemUpdated,
  selectGuestCart,
  useCartQuery,
  useClearUnavailableMutation,
  useIsAuthenticated,
  useMarketplaceMode,
  useRemoveCartItemMutation,
  useSelectAllCartMutation,
  useUpdateCartItemMutation,
  useWishlistToggle,
} from '@marketbd/api-client';
import { BRAND } from '@marketbd/shared';
import type { SellerSummary } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronRight, Heart, Minus, Plus, ShoppingCart, Store, Trash2 } from 'lucide-react-native';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { DealsGrid, ProductRail } from '@/components/product-card';
import { Button, Checkbox, colors, Empty, Loading, ScreenHeader } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { useRecentlyViewed } from '@/lib/recently-viewed';

interface Line {
  key: string;
  productId: string;
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
  seller: SellerSummary | null;
}

/** Quantity control: shows a bin instead of "−" at quantity 1, like the reference app. */
function QtyControl({ value, max, onChange, onRemove }: { value: number; max: number; onChange: (q: number) => void; onRemove: () => void }) {
  return (
    <View className="h-9 flex-row items-center overflow-hidden rounded-md border border-ink-200">
      <Pressable className="h-full w-9 items-center justify-center" onPress={() => (value <= 1 ? onRemove() : onChange(value - 1))} accessibilityLabel={value <= 1 ? 'Remove' : 'Decrease'}>
        {value <= 1 ? <Trash2 size={16} color={colors.warning} /> : <Minus size={16} color={colors.ink} />}
      </Pressable>
      <Text className="w-9 border-x border-ink-200 text-center leading-9 text-ink-900">{value}</Text>
      <Pressable className="h-full w-9 items-center justify-center" disabled={value >= max} onPress={() => onChange(value + 1)} accessibilityLabel="Increase">
        <Plus size={16} color={value >= max ? colors.border : colors.accent} />
      </Pressable>
    </View>
  );
}

function SaveButton({ productId }: { productId: string }) {
  const wishlist = useWishlistToggle(productId);
  return (
    <Pressable
      hitSlop={8}
      accessibilityLabel="Save to wishlist"
      onPress={async () => {
        if (!wishlist.authed) return router.push({ pathname: '/login', params: { next: '/cart' } });
        await wishlist.toggle();
      }}
    >
      <Heart size={22} color={wishlist.saved ? colors.accent : colors.ink} fill={wishlist.saved ? colors.accent : 'transparent'} />
    </Pressable>
  );
}

export default function CartScreen() {
  const { t, money, pick } = useI18n();
  const dispatch = useDispatch();
  const authed = useIsAuthenticated();
  const { showSellerInfo } = useMarketplaceMode();
  const guest = useSelector(selectGuestCart);
  const { data, isLoading, isFetching, refetch } = useCartQuery(undefined, { skip: !authed });
  const [update] = useUpdateCartItemMutation();
  const [remove] = useRemoveCartItemMutation();
  const [selectAll] = useSelectAllCartMutation();
  const [clearUnavailable] = useClearUnavailableMutation();
  const recent = useRecentlyViewed();

  const lines: Line[] = authed
    ? (data?.items ?? []).map((i) => ({
        key: i.id,
        productId: i.product.id,
        slug: i.product.slug,
        title: pick(i.product.title, i.product.titleBn),
        imageUrl: i.product.imageUrl,
        variantLabel: Object.values(i.variant.attributes).join(', '),
        unitPrice: i.unitPrice,
        compareAtPrice: i.compareAtPrice,
        quantity: i.quantity,
        stock: i.variant.stock,
        selected: i.selected,
        available: i.available,
        reason: i.unavailableReason,
        seller: i.seller,
      }))
    : guest.map((g) => ({
        key: g.variantId,
        productId: g.productId,
        slug: g.slug,
        title: pick(g.title, g.titleBn),
        imageUrl: g.imageUrl,
        variantLabel: g.variantLabel === 'Default' ? '' : g.variantLabel,
        unitPrice: g.unitPrice,
        compareAtPrice: g.compareAtPrice,
        quantity: g.quantity,
        stock: g.stock,
        selected: g.selected,
        available: true,
        reason: null,
        seller: null,
      }));

  const payable = lines.filter((l) => l.selected && l.available);
  const subtotal = authed ? (data?.summary.subtotal ?? 0) : payable.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const count = payable.reduce((n, l) => n + l.quantity, 0);
  const selectable = lines.filter((l) => l.available);
  const allSelected = selectable.length > 0 && selectable.every((l) => l.selected);
  const unavailable = lines.some((l) => !l.available);

  const setQty = (l: Line, q: number) => (authed ? void update({ id: l.key, quantity: q }) : dispatch(guestItemUpdated({ variantId: l.key, quantity: q })));
  const setSelected = (l: Line, s: boolean) => (authed ? void update({ id: l.key, selected: s }) : dispatch(guestItemUpdated({ variantId: l.key, selected: s })));
  const removeLine = (l: Line) => (authed ? void remove(l.key) : dispatch(guestItemRemoved(l.key)));
  const confirmRemove = (l: Line) =>
    Alert.alert(t.cart.remove, l.title, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => removeLine(l) },
    ]);
  const setAll = (s: boolean) => (authed ? void selectAll(s) : dispatch(guestAllSelected(s)));

  // One group per seller in multi-vendor mode, mirroring how the order is split into packages.
  const groups = new Map<string, { seller: SellerSummary | null; lines: Line[] }>();
  for (const l of lines) {
    const key = showSellerInfo && l.seller ? l.seller.id : 'all';
    const g = groups.get(key) ?? { seller: showSellerInfo ? l.seller : null, lines: [] };
    g.lines.push(l);
    groups.set(key, g);
  }

  const header = (
    <ScreenHeader back={router.canGoBack()}>
      <View className="flex-1 flex-row items-center">
        <View className="flex-row items-center gap-2">
          <Checkbox checked={allSelected} onPress={() => setAll(!allSelected)} disabled={!selectable.length} label="Select all" />
          <Text className="text-lg text-ink-700">All</Text>
        </View>
        <Text className="flex-1 text-center text-xl font-bold text-ink-900">My Cart</Text>
        <View className="w-14" />
      </View>
    </ScreenHeader>
  );

  if (authed && isLoading) {
    return (
      <View className="flex-1 bg-canvas">
        {header}
        <Loading />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      {header}
      <ScrollView
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 24, gap: 12 }}
        refreshControl={authed ? <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} /> : undefined}
      >
        {lines.length === 0 ? (
          <Empty
            icon={<ShoppingCart size={56} color={colors.muted} />}
            title={t.cart.empty}
            text={t.cart.emptyHint}
            action={<Button title={t.checkout.continueShopping} onPress={() => router.push('/')} />}
          />
        ) : null}

        {unavailable ? (
          <Pressable onPress={() => void clearUnavailable()} className="mx-3 rounded-lg bg-amber-50 p-3">
            <Text className="text-sm text-amber-800">
              {t.cart.blocked} · <Text className="font-semibold">{t.cart.removeUnavailable}</Text>
            </Text>
          </Pressable>
        ) : null}

        {[...groups.entries()].map(([key, g]) => {
          const groupLines = g.lines.filter((l) => l.available);
          const groupAll = groupLines.length > 0 && groupLines.every((l) => l.selected);
          return (
            <View key={key} className="mx-3 overflow-hidden rounded-xl bg-white">
              <View className="flex-row items-center gap-2.5 border-b border-ink-100 px-3 py-3">
                <Checkbox checked={groupAll} onPress={() => groupLines.forEach((l) => setSelected(l, !groupAll))} label="Select shop" />
                {g.seller ? (
                  <Pressable onPress={() => router.push(`/shop/${g.seller!.slug}`)} className="flex-1 flex-row items-center gap-2">
                    {g.seller.logoUrl ? <Image source={img(g.seller.logoUrl, 28)} style={{ width: 28, height: 28, borderRadius: 4 }} /> : <Store size={20} color={colors.primary} />}
                    {g.seller.isHouseStore ? (
                      <View className="rounded bg-accent-500 px-1.5 py-0.5">
                        <Text className="text-[10px] font-bold uppercase text-white">Official Store</Text>
                      </View>
                    ) : null}
                    <Text numberOfLines={1} className="flex-shrink text-lg font-medium text-ink-900">{g.seller.shopName}</Text>
                    <ChevronRight size={18} color={colors.ink} />
                  </Pressable>
                ) : (
                  <Text className="flex-1 text-lg font-medium text-ink-900">{t.cart.title}</Text>
                )}
                <Text className="text-sm text-ink-500">
                  {g.lines.length} {g.lines.length === 1 ? 'item' : 'items'}
                </Text>
              </View>

              {g.lines.map((l, i) => (
                <View key={l.key} className={`flex-row gap-2.5 p-3 ${i ? 'border-t border-ink-100' : ''} ${l.available ? '' : 'opacity-60'}`}>
                  <View className="pt-1">
                    <Checkbox checked={l.selected && l.available} disabled={!l.available} onPress={() => setSelected(l, !l.selected)} label={l.title} />
                  </View>
                  <View className="items-center gap-2">
                    <Pressable onPress={() => router.push(`/product/${l.slug}`)}>
                      <Image source={img(l.imageUrl, 88)} style={{ width: 88, height: 88, borderRadius: 8 }} contentFit="cover" />
                    </Pressable>
                    <Pressable onPress={() => router.push({ pathname: '/search', params: { q: l.title.split(/\s+/).slice(0, 3).join(' ') } })} className="rounded-md bg-primary-50 px-2 py-1.5">
                      <Text className="text-xs font-medium text-primary-800">More like this</Text>
                    </Pressable>
                  </View>
                  <View className="flex-1 gap-1.5">
                    <View className="flex-row gap-2">
                      <Text numberOfLines={2} className="flex-1 text-base leading-5 text-ink-900">{l.title}</Text>
                      <View className="items-center gap-3">
                        <SaveButton productId={l.productId} />
                        <Pressable hitSlop={8} onPress={() => confirmRemove(l)} accessibilityLabel={t.cart.remove}>
                          <Trash2 size={22} color={colors.ink} />
                        </Pressable>
                      </View>
                    </View>
                    {l.variantLabel ? (
                      <View className="self-start rounded-full bg-ink-50 px-3 py-1">
                        <Text className="text-sm text-ink-800">{l.variantLabel}</Text>
                      </View>
                    ) : null}
                    {l.seller && showSellerInfo ? (
                      <Text className="text-sm text-accent-600">{l.seller.isHouseStore ? `Fulfilled by ${BRAND.name}` : `Sold by ${l.seller.shopName}`}</Text>
                    ) : null}
                    {l.reason ? <Text className="text-sm text-danger">{l.reason}</Text> : null}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-baseline gap-1.5">
                        <Text className="text-lg font-bold text-accent-600">{money(l.unitPrice)}</Text>
                        {l.compareAtPrice && l.compareAtPrice > l.unitPrice ? <Text className="text-sm text-ink-400 line-through">{money(l.compareAtPrice)}</Text> : null}
                      </View>
                      <QtyControl value={l.quantity} max={Math.max(1, Math.min(l.stock, 20))} onChange={(q) => setQty(l, q)} onRemove={() => confirmRemove(l)} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          );
        })}

        {recent.length ? (
          <View className="gap-3">
            <Text className="px-3 text-xl font-bold text-ink-900">Recently viewed</Text>
            <ProductRail products={recent.filter((p) => !lines.some((l) => l.productId === p.id))} />
          </View>
        ) : null}

        <DealsGrid excludeIds={lines.map((l) => l.productId)} />
      </ScrollView>

      <View className="flex-row items-center gap-3 rounded-t-2xl bg-white px-4 pt-3 shadow-lg" style={{ paddingBottom: 12 }}>
        <View className="flex-1">
          <Text className="text-sm text-ink-700">{t.cart.subtotal}:</Text>
          <Text className="text-xl font-bold text-accent-600">{money(subtotal)}</Text>
        </View>
        <Pressable
          disabled={authed && count === 0}
          onPress={() => router.push(authed ? '/checkout' : { pathname: '/login', params: { next: '/checkout' } })}
          className={`h-12 items-center justify-center rounded-xl bg-primary-700 px-6 ${authed && count === 0 ? 'opacity-50' : ''}`}
        >
          <Text className="text-lg font-semibold text-white">{authed ? (count ? `Checkout (${count})` : 'Checkout') : t.common.signIn}</Text>
        </Pressable>
      </View>
    </View>
  );
}
