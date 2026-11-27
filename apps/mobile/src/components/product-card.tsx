import { useAddToCart, useCountdown, useProductFeedQuery } from '@marketbd/api-client';
import type { ProductCard as ProductCardData } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowDown, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { colors, RatingPill } from './ui';

/** Adds a single-variant product straight from a card; products with options open the product page instead. */
export function useCardAddToCart(product: ProductCardData) {
  const { t } = useI18n();
  const { add, isLoading } = useAddToCart();
  const onAdd = async () => {
    const v = product.defaultVariant;
    if (!v || product.variantCount > 1) {
      router.push(`/product/${product.slug}`);
      return;
    }
    const ok = await add(product, {
      id: v.id,
      sku: v.sku,
      attributes: v.attributes,
      price: product.flash ? (product.compareAtPrice ?? product.price) : product.price,
      compareAtPrice: product.compareAtPrice,
      stock: v.stock,
      isActive: true,
      flash: product.flash,
    });
    Alert.alert(ok ? t.product.added : t.common.error);
  };
  return { onAdd, adding: isLoading };
}

export function PriceLine({ price, compareAt, pct, size = 'md' }: { price: number; compareAt: number | null; pct: number; size?: 'md' | 'lg' }) {
  const { money } = useI18n();
  return (
    <View className="flex-row flex-wrap items-baseline gap-x-1.5">
      <Text className={`font-bold text-accent-600 ${size === 'lg' ? 'text-2xl' : 'text-base'}`}>{money(price)}</Text>
      {compareAt && compareAt > price ? <Text className="text-xs text-ink-400 line-through">{money(compareAt)}</Text> : null}
      {pct > 0 ? (
        <View className="flex-row items-center">
          <ArrowDown size={11} color={colors.accent} />
          <Text className="text-xs font-semibold text-accent-600">{pct}%</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Grid / rail card: image with rating pill, verified tag + 2-line title, price row and an "Add to Cart" button.
 * `fill` makes it share a row (grids); rails give it a fixed-width wrapper instead.
 */
export function ProductCard({ product, fill = true }: { product: ProductCardData; fill?: boolean }) {
  const { t, pick } = useI18n();
  const { onAdd, adding } = useCardAddToCart(product);
  return (
    <View className={`overflow-hidden rounded-xl bg-white ${fill ? 'flex-1' : ''}`}>
      <Pressable onPress={() => router.push(`/product/${product.slug}`)}>
        <View className="aspect-square bg-ink-50">
          <Image source={img(product.imageUrl, 200)} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
          {product.flash ? (
            <View className="absolute left-0 top-2 rounded-r bg-flash px-1.5 py-0.5">
              <Text className="text-[10px] font-bold uppercase text-white">Flash</Text>
            </View>
          ) : null}
          {product.ratingCount > 0 ? (
            <View className="absolute bottom-1.5 left-1.5">
              <RatingPill value={product.ratingAvg} count={product.ratingCount} />
            </View>
          ) : null}
          {!product.inStock ? (
            <View className="absolute inset-x-0 bottom-0 bg-black/60 py-1">
              <Text className="text-center text-[11px] font-semibold text-white">{t.common.outOfStock}</Text>
            </View>
          ) : null}
        </View>
        <View className="gap-1 px-2.5 pt-2">
          <Text numberOfLines={2} className="min-h-[36px] text-[13px] leading-[18px] text-ink-800">
            {product.seller?.isVerified ? (
              <Text className="text-[11px] font-bold text-primary-700">{product.seller.isHouseStore ? '✓ Official  ' : '✓ Verified  '}</Text>
            ) : null}
            {pick(product.title, product.titleBn)}
          </Text>
          <PriceLine price={product.price} compareAt={product.compareAtPrice} pct={product.discountPercent} />
          <Text className="text-[11px] text-ink-500">{product.soldCount > 0 ? `${product.soldCount.toLocaleString()} ${t.common.sold}` : ' '}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => void onAdd()}
        disabled={!product.inStock || adding}
        className={`m-2.5 mt-1.5 h-10 items-center justify-center rounded-lg bg-primary-50 ${product.inStock ? '' : 'opacity-50'}`}
      >
        {adding ? <ActivityIndicator color={colors.primary} /> : <Text className="font-semibold text-primary-800">{t.product.addToCart}</Text>}
      </Pressable>
    </View>
  );
}

/** Horizontal rail of product cards (≈2.3 visible). */
export function ProductRail({ products, width = 160 }: { products: ProductCardData[]; width?: number }) {
  if (!products.length) return null;
  return (
    <FlatList
      data={products}
      horizontal
      keyExtractor={(p) => p.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingHorizontal: 12 }}
      renderItem={({ item }) => (
        <View style={{ width }}>
          <ProductCard product={item} fill={false} />
        </View>
      )}
    />
  );
}

/** Compact horizontal card (image left) used for "Frequently bought together". */
export function MiniProductCard({ product }: { product: ProductCardData }) {
  const { money, pick } = useI18n();
  const { onAdd, adding } = useCardAddToCart(product);
  return (
    <Pressable onPress={() => router.push(`/product/${product.slug}`)} className="w-72 flex-row gap-3 rounded-xl bg-ink-50 p-2.5">
      <Image source={img(product.imageUrl, 72)} style={{ width: 72, height: 72, borderRadius: 8 }} contentFit="cover" />
      <View className="flex-1 justify-between">
        <Text numberOfLines={1} className="text-sm text-ink-800">{pick(product.title, product.titleBn)}</Text>
        {product.ratingCount > 0 ? (
          <Text className="text-xs text-ink-600">
            ★ {product.ratingAvg.toFixed(1)} <Text className="text-ink-400">({product.ratingCount})</Text>
          </Text>
        ) : null}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-base font-bold text-accent-600">{money(product.price)}</Text>
            {product.compareAtPrice && product.compareAtPrice > product.price ? (
              <Text className="text-xs text-ink-400 line-through">{money(product.compareAtPrice)}</Text>
            ) : null}
          </View>
          <Pressable onPress={() => void onAdd()} disabled={adding} accessibilityLabel="Add to cart" className="size-9 items-center justify-center rounded-lg bg-primary-50">
            {adding ? <ActivityIndicator size="small" color={colors.primary} /> : <ShoppingCart size={18} color={colors.primaryDark} />}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * "Deals you can't miss" grid for use inside a ScrollView (no nested virtualised list):
 * renders pages of the popular feed with a Load more button.
 */
export function DealsGrid({ excludeIds = [] }: { excludeIds?: string[] }) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const { data, isFetching } = useProductFeedQuery({ page, limit: 12, sort: 'popular' });
  const items = (data?.items ?? []).filter((p) => !excludeIds.includes(p.id));
  const hasMore = data ? data.meta.page < data.meta.totalPages : false;
  const rows: ProductCardData[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View className="gap-2.5">
      <Text className="px-3 text-xl font-bold text-ink-900">{t.home.dealsCantMiss}</Text>
      {rows.map((row) => (
        <View key={row[0]!.id} className="flex-row gap-2.5 px-3">
          {row.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
      <View className="items-center py-3">
        {isFetching ? (
          <ActivityIndicator color={colors.primary} />
        ) : hasMore ? (
          <Pressable onPress={() => data && setPage(data.meta.page + 1)} className="rounded-full border border-ink-300 bg-white px-8 py-2.5">
            <Text className="font-semibold text-ink-800">{t.common.loadMore}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Countdown({ endsAt, boxed = false }: { endsAt: string; boxed?: boolean }) {
  const { days, hours, minutes, seconds } = useCountdown(endsAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const cells = [days * 24 + hours, minutes, seconds];
  return (
    <View className="flex-row items-center gap-1">
      {cells.map((v, i) => (
        <View key={i} className="flex-row items-center gap-1">
          <View className={boxed ? 'min-w-10 rounded-md bg-ink-900 px-1.5 py-1.5' : 'min-w-7 rounded bg-flash px-1 py-0.5'}>
            <Text className={`text-center font-bold text-white ${boxed ? 'text-lg' : 'text-xs'}`}>{pad(v)}</Text>
          </View>
          {i < 2 ? <Text className={`font-bold ${boxed ? 'text-lg text-ink-900' : 'text-flash'}`}>:</Text> : null}
        </View>
      ))}
    </View>
  );
}

