import {
  errorMessage,
  useAddToCart,
  useMarketplaceMode,
  useProductQuery,
  useProductReviewsQuery,
  useRelatedProductsQuery,
  useWishlistToggle,
} from '@marketbd/api-client';
import { discountPercent, fill, SHIPPING_FEES, type VariantView } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, Heart, RotateCcw, Store, Truck, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Countdown, ProductCard } from '@/components/product-card';
import { Button, Card, colors, ErrorView, Loading, Price, Stars, Stepper } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';

const findVariant = (variants: VariantView[], sel: Record<string, string>) =>
  variants.find((v) => Object.entries(sel).every(([k, val]) => v.attributes[k] === val)) ?? null;

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, money, pick } = useI18n();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { showSellerInfo } = useMarketplaceMode();
  const { data: product, isLoading, isError, refetch } = useProductQuery(slug);
  const { data: related } = useRelatedProductsQuery(slug);
  const { data: reviews } = useProductReviewsQuery({ productId: product?.id ?? '', limit: 3 }, { skip: !product });
  const [selection, setSelection] = useState<Record<string, string> | null>(null);
  const [qty, setQty] = useState(1);
  const { add, isLoading: adding } = useAddToCart();
  const wishlist = useWishlistToggle(product?.id ?? '');

  if (isError) return <ErrorView message={t.common.error} onRetry={() => void refetch()} />;
  if (isLoading || !product) return <Loading />;

  const initial = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const sel = selection ?? initial?.attributes ?? {};
  const variant = findVariant(product.variants, sel);
  const price = variant ? (variant.flash?.specialPrice ?? variant.price) : product.price;
  const compareAt = variant ? (variant.flash ? variant.price : variant.compareAtPrice) : product.compareAtPrice;
  const stock = variant?.stock ?? 0;

  const handleAdd = async (buyNow: boolean) => {
    if (!variant) return;
    const ok = await add(product, variant, qty);
    if (!ok) return Alert.alert(t.common.error);
    if (buyNow) router.push('/cart');
    else Alert.alert(t.product.added);
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <FlatList
          data={product.images}
          horizontal
          pagingEnabled
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => <Image source={img(item.url, width)} style={{ width, height: width }} contentFit="cover" />}
        />
        <View className="gap-3 p-3">
          {variant?.flash ? (
            <View className="flex-row items-center justify-between rounded-lg bg-flash px-3 py-2">
              <View className="flex-row items-center gap-1">
                <Zap size={16} color="#fff" fill="#fff" />
                <Text className="font-bold text-white">{t.home.flashSale}</Text>
              </View>
              <Countdown endsAt={variant.flash.endsAt} />
            </View>
          ) : null}
          <Card className="gap-2">
            <Price value={price} compareAt={compareAt} large />
            {discountPercent(price, compareAt) > 0 ? <Text className="text-xs font-semibold text-accent-600">-{discountPercent(price, compareAt)}% {t.common.off}</Text> : null}
            <Text className="text-base font-semibold text-ink-900">{pick(product.title, product.titleBn)}</Text>
            <View className="flex-row items-center gap-2">
              <Stars value={product.ratingAvg} />
              <Text className="text-xs text-ink-500">
                {product.ratingAvg.toFixed(1)} · {product.ratingCount} {t.common.reviews} · {product.soldCount} {t.common.sold}
              </Text>
            </View>
          </Card>

          {Object.entries(product.options).map(([key, values]) => (
            <Card key={key} className="gap-2">
              <Text className="text-sm capitalize text-ink-500">
                {key}: <Text className="font-semibold text-ink-900">{sel[key] ?? '—'}</Text>
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {values.map((v) => {
                  const active = sel[key] === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => {
                        setSelection({ ...sel, [key]: v });
                        setQty(1);
                      }}
                      className={`rounded-md border px-3 py-1.5 ${active ? 'border-primary-700 bg-primary-50' : 'border-ink-200'}`}
                    >
                      <Text className={active ? 'font-semibold text-primary-800' : 'text-ink-700'}>{v}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          ))}

          <Card className="flex-row items-center justify-between">
            <Text className="text-sm text-ink-500">{t.product.quantity}</Text>
            <View className="flex-row items-center gap-3">
              <Text className={`text-xs ${stock === 0 ? 'text-red-600' : stock <= 5 ? 'font-semibold text-flash' : 'text-ink-500'}`}>
                {stock === 0 ? t.common.outOfStock : stock <= 5 ? fill(t.product.onlyLeft, { n: stock }) : t.common.inStock}
              </Text>
              <Stepper value={qty} max={Math.max(1, Math.min(stock, 20))} onChange={setQty} />
            </View>
          </Card>

          <Card className="gap-2">
            <View className="flex-row items-center gap-2">
              <Truck size={16} color={colors.primary} />
              <Text className="flex-1 text-xs text-ink-700">
                {t.product.insideDhaka} {money(SHIPPING_FEES.INSIDE_DHAKA)} · {t.product.outsideDhaka} {money(SHIPPING_FEES.OUTSIDE_DHAKA)}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <RotateCcw size={16} color={colors.primary} />
              <Text className="text-xs text-ink-700">{t.product.returns} · {t.product.cod}</Text>
            </View>
          </Card>

          {showSellerInfo && product.seller ? (
            <Card className="flex-row items-center gap-3">
              <Image source={img(product.seller.logoUrl, 44)} style={{ width: 44, height: 44, borderRadius: 8 }} />
              <View className="flex-1">
                <Text className="text-xs text-ink-500">{t.common.soldBy}</Text>
                <View className="flex-row items-center gap-1">
                  <Text className="font-semibold">{product.seller.shopName}</Text>
                  {product.seller.isHouseStore ? <BadgeCheck size={14} color={colors.primary} /> : null}
                </View>
              </View>
              <Pressable onPress={() => router.push(`/shop/${product.seller!.slug}`)} className="flex-row items-center gap-1 rounded-md border border-primary-700 px-3 py-1.5">
                <Store size={14} color={colors.primary} />
                <Text className="text-xs font-semibold text-primary-700">{t.common.visitStore}</Text>
              </Pressable>
            </Card>
          ) : null}

          <Card className="gap-2">
            <Text className="font-semibold">{t.product.description}</Text>
            <Text className="text-sm leading-5 text-ink-700">{pick(product.description, product.descriptionBn)}</Text>
          </Card>

          <Card className="gap-3">
            <Text className="font-semibold">{t.product.ratingsReviews}</Text>
            {reviews && reviews.items.length ? (
              reviews.items.map((r) => (
                <View key={r.id} className="gap-1 border-b border-ink-100 pb-2">
                  <View className="flex-row items-center gap-2">
                    <Stars value={r.rating} />
                    <Text className="text-xs font-medium">{r.user.name}</Text>
                    {r.isVerifiedPurchase ? <Text className="text-[10px] text-green-700">✓ {t.product.verified}</Text> : null}
                  </View>
                  {r.comment ? <Text className="text-sm text-ink-700">{r.comment}</Text> : null}
                </View>
              ))
            ) : (
              <Text className="text-sm text-ink-500">{t.product.noReviews}</Text>
            )}
          </Card>

          {related && related.length ? (
            <View>
              <Text className="mb-2 text-lg font-bold">{t.product.related}</Text>
              <View className="flex-row flex-wrap justify-between gap-y-2">
                {related.slice(0, 6).map((p) => (
                  <View key={p.id} style={{ width: (width - 32) / 2 }}>
                    <ProductCard product={p} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 flex-row gap-2 border-t border-ink-100 bg-white p-2" style={{ paddingBottom: insets.bottom + 8 }}>
        <Pressable
          className="h-12 w-12 items-center justify-center"
          accessibilityLabel={t.product.saveToWishlist}
          onPress={async () => {
            if (!wishlist.authed) return router.push({ pathname: '/login', params: { next: `/product/${slug}` } });
            try {
              await wishlist.toggle();
            } catch (e) {
              Alert.alert(errorMessage(e));
            }
          }}
        >
          <Heart size={22} color={wishlist.saved ? colors.accent : colors.muted} fill={wishlist.saved ? colors.accent : 'transparent'} />
        </Pressable>
        <Button title={t.product.buyNow} variant="accent" className="flex-1" disabled={stock === 0} loading={adding} onPress={() => void handleAdd(true)} />
        <Button title={t.product.addToCart} className="flex-1" disabled={stock === 0} loading={adding} onPress={() => void handleAdd(false)} />
      </View>
    </View>
  );
}
