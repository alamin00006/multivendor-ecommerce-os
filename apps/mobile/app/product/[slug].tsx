import {
  errorMessage,
  useAddToCart,
  useAskQuestionMutation,
  selectUser,
  useAvailableCouponsQuery,
  useCollectCouponMutation,
  useBoughtTogetherQuery,
  useIsAuthenticated,
  useMarketplaceMode,
  useProductQuery,
  useProductQuestionsQuery,
  useProductReviewsQuery,
  useProductsQuery,
  usePublicSettingsQuery,
  useRelatedProductsQuery,
  useReviewSummaryQuery,
  useStartConversationMutation,
  useWishlistToggle,
} from '@marketbd/api-client';
import { discountPercent, fill, type ProductCard as ProductCardData, type ProductDetail, type VariantView } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Heart, MessageCircle, RotateCcw, Search, Share2, ShieldCheck, ShoppingCart, Store, Ticket, Truck, X, Zap } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, Share, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Countdown, DealsGrid, MiniProductCard, ProductRail, useCardAddToCart } from '@/components/product-card';
import { CartIconButton, colors, ErrorView, Loading, RatingPill, Stars, Stepper } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { rememberViewed } from '@/lib/recently-viewed';
import { voucherAmount, voucherKind } from '@/lib/vouchers';
import { useSelector } from 'react-redux';

const findVariant = (variants: VariantView[], sel: Record<string, string>) =>
  variants.find((v) => Object.entries(sel).every(([k, val]) => v.attributes[k] === val)) ?? null;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

type SectionId = 'overview' | 'specs' | 'details' | 'reviews' | 'questions' | 'store' | 'similar' | 'deals';
const TAB_LABEL: Record<SectionId, string> = {
  overview: 'Overview',
  specs: 'Specifications',
  details: 'Product Details',
  reviews: 'Reviews',
  questions: 'Questions',
  store: 'More From Store',
  similar: 'Similar Products',
  deals: "Deals you can't miss",
};

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`mt-2.5 bg-white px-4 py-4 ${className}`}>{children}</View>;
}

function MoreToggle({ open, onPress }: { open: boolean; onPress: () => void }) {
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <Pressable onPress={onPress} className="mt-2 flex-row items-center justify-center gap-1 py-1">
      <Text className="text-base text-ink-500">{open ? 'See Less' : 'See More'}</Text>
      <Icon size={18} color={colors.muted} />
    </Pressable>
  );
}

function ViewAll({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="-mx-4 -mb-4 mt-3 flex-row items-center justify-center gap-1 bg-accent-50 py-3.5">
      <Text className="font-medium text-accent-700">{label}</Text>
      <ChevronRight size={16} color={colors.accent} />
    </Pressable>
  );
}

function InfoRow({ icon, title, sub, right, onPress }: { icon: ReactNode; title: ReactNode; sub?: string; right?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="flex-row items-center gap-3 py-2.5">
      <View className="size-12 items-center justify-center rounded-lg bg-primary-50">{icon}</View>
      <View className="flex-1">
        <Text className="text-base text-primary-800">{title}</Text>
        {sub ? <Text className="text-sm text-ink-600">{sub}</Text> : null}
      </View>
      {right ? <Text className="font-semibold text-ink-900">{right}</Text> : null}
      {onPress ? <ChevronRight size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

/** Variant option picker: image tiles when the value has its own photo, text chips otherwise. */
function OptionPicker({ product, sel, onPick }: { product: ProductDetail; sel: Record<string, string>; onPick: (key: string, value: string) => void }) {
  return (
    <>
      {Object.entries(product.options).map(([key, values]) => (
        <View key={key} className="gap-2 pt-3">
          <Text className="text-base capitalize text-ink-600">
            {key} : <Text className="font-semibold text-ink-900">{sel[key] ?? '—'}</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {values.map((v) => {
              const on = sel[key] === v;
              const variant = product.variants.find((x) => x.attributes[key] === v);
              const photo = variant ? product.images.find((i) => i.variantId === variant.id) : undefined;
              return photo ? (
                <Pressable key={v} onPress={() => onPick(key, v)} className={`w-24 overflow-hidden rounded-xl border-2 ${on ? 'border-primary-600 bg-primary-50' : 'border-ink-100 bg-white'}`}>
                  <Image source={img(photo.url, 96)} style={{ width: '100%', height: 88 }} contentFit="cover" />
                  <Text className={`py-1.5 text-center text-sm ${on ? 'font-semibold text-primary-800' : 'text-ink-700'}`}>{v}</Text>
                </Pressable>
              ) : (
                <Pressable key={v} onPress={() => onPick(key, v)} className={`rounded-lg border-2 px-4 py-2 ${on ? 'border-primary-600 bg-primary-50' : 'border-ink-200 bg-white'}`}>
                  <Text className={on ? 'font-semibold text-primary-800' : 'text-ink-700'}>{v}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ))}
    </>
  );
}

/** Vouchers that work for this product: MarketBD and payment vouchers plus this shop's own vouchers. */
function Vouchers({ sellerId, slug }: { sellerId: string | null; slug: string }) {
  const { money } = useI18n();
  const user = useSelector(selectUser);
  const { data: all = [] } = useAvailableCouponsQuery(user?.id);
  const [collect] = useCollectCouponMutation();
  const [busy, setBusy] = useState<string | null>(null);
  const coupons = all.filter((c) => c.scope !== 'STORE' || (sellerId !== null && c.seller?.id === sellerId));
  if (!coupons.length) return null;
  const onCollect = async (id: string) => {
    if (!user) return router.push({ pathname: '/login', params: { next: `/product/${slug}` } });
    setBusy(id);
    try {
      await collect(id).unwrap();
    } catch (e) {
      Alert.alert(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Panel>
      <View className="mb-3 flex-row items-center gap-1">
        <Text className="text-xl font-bold text-ink-900">Vouchers</Text>
        <ChevronRight size={20} color={colors.ink} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {coupons.map((c) => (
          <View key={c.id} className="w-72 rounded-xl border-2 border-accent-300 bg-accent-50">
            <View className="flex-row gap-3 p-3">
              <View className="size-12 items-center justify-center rounded-lg bg-accent-500">
                <Ticket size={24} color="#fff" />
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-sm font-semibold text-ink-700">{voucherKind(c)}</Text>
                <Text className="text-xl font-bold text-accent-700">{voucherAmount(c, money)}</Text>
                <Text className="text-xs text-ink-500">Min. Spend {money(c.minOrderAmount)}</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between border-t border-dashed border-accent-300 px-3 py-2">
              <Text className="text-xs text-ink-500">Until {fmtDate(c.endsAt)}</Text>
              {c.collected ? (
                <Pressable onPress={() => router.push('/cart')} className="rounded-md border border-accent-600 bg-white px-4 py-1.5">
                  <Text className="font-semibold text-accent-700">Use Now</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => void onCollect(c.id)} disabled={busy === c.id} className="min-w-20 items-center rounded-md bg-accent-600 px-4 py-1.5">
                  {busy === c.id ? <ActivityIndicator size="small" color="#fff" /> : <Text className="font-semibold text-white">Collect</Text>}
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </Panel>
  );
}

function SpecsModal({ product, sku, open, onClose }: { product: ProductDetail; sku: string | undefined; open: boolean; onClose: () => void }) {
  const { t, pick } = useI18n();
  const insets = useSafeAreaInsets();
  const rows: [string, string][] = [
    ...(product.brand ? [[t.product.brand, product.brand.name] as [string, string]] : []),
    [t.product.category, pick(product.category.name, product.category.nameBn)],
    ...(sku ? [[t.product.sku, sku] as [string, string]] : []),
    ...Object.entries(product.options).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v.join(', ')] as [string, string]),
    ...product.specifications.map((s) => [s.label, s.value] as [string, string]),
    ['Warranty', product.warranty ?? 'No warranty'],
  ];
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="max-h-[75%] rounded-t-2xl bg-white" style={{ paddingBottom: insets.bottom + 12 }}>
        <View className="flex-row items-center justify-between border-b border-ink-100 px-4 py-3">
          <Text className="text-lg font-bold">{t.product.specifications}</Text>
          <Pressable onPress={onClose} accessibilityLabel={t.common.close} hitSlop={10}>
            <X size={22} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {rows.map(([label, value], i) => (
            <View key={`${label}-${i}`} className={`flex-row py-2.5 ${i ? 'border-t border-ink-100' : ''}`}>
              <Text className="w-32 text-sm text-ink-500">{label}</Text>
              <Text className="flex-1 text-sm text-ink-900">{value}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Reviews({ productId }: { productId: string }) {
  const { t } = useI18n();
  const [limit, setLimit] = useState(2);
  const [open, setOpen] = useState(true);
  const { data: summary } = useReviewSummaryQuery(productId);
  const { data } = useProductReviewsQuery({ productId, page: 1, limit });
  const total = data?.meta.total ?? 0;
  return (
    <>
      <Pressable onPress={() => setOpen(!open)} className="flex-row items-center gap-2">
        <Text className="text-xl font-bold text-ink-900">Ratings and Reviews</Text>
        {summary && summary.count > 0 ? <RatingPill value={summary.average} count={summary.count} /> : null}
        <View className="flex-1" />
        {open ? <ChevronUp size={20} color={colors.ink} /> : <ChevronDown size={20} color={colors.ink} />}
      </Pressable>
      {open ? (
        <>
          {data?.items.length ? (
            data.items.map((r) => (
              <View key={r.id} className="mt-4 gap-2">
                <View className="flex-row items-center gap-3">
                  {r.user.avatarUrl ? (
                    <Image source={img(r.user.avatarUrl, 40)} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  ) : (
                    <View className="size-10 items-center justify-center rounded-full bg-primary-50">
                      <Text className="font-bold text-primary-700">{r.user.name.charAt(0)}</Text>
                    </View>
                  )}
                  <View>
                    <Stars value={r.rating} size={14} />
                    <Text className="text-sm text-ink-600">
                      <Text className="font-semibold text-ink-800">{r.user.name}</Text> on {fmtDate(r.createdAt)}
                      {r.isVerifiedPurchase ? <Text className="text-success"> · ✓ {t.product.verified}</Text> : null}
                    </Text>
                  </View>
                </View>
                {r.comment ? <Text className="text-base text-ink-800">{r.comment}</Text> : null}
                {r.sellerReply ? (
                  <View className="rounded-md border-l-2 border-primary-600 bg-primary-50 px-3 py-2">
                    <Text className="text-xs font-semibold text-primary-800">Seller’s response</Text>
                    <Text className="mt-0.5 text-sm text-ink-700">{r.sellerReply}</Text>
                  </View>
                ) : null}
                {r.images.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {r.images.map((u) => (
                      <Image key={u} source={img(u, 64)} style={{ width: 64, height: 64, borderRadius: 6 }} />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            ))
          ) : (
            <Text className="mt-3 text-sm text-ink-500">{t.product.noReviews}</Text>
          )}
          {total > limit ? <ViewAll label="View All Reviews" onPress={() => setLimit((n) => n + 5)} /> : null}
        </>
      ) : null}
    </>
  );
}

function Questions({ productId, slug }: { productId: string; slug: string }) {
  const authed = useIsAuthenticated();
  const [limit, setLimit] = useState(2);
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const { data } = useProductQuestionsQuery({ productId, page: 1, limit });
  const [ask, askState] = useAskQuestionMutation();
  const total = data?.meta.total ?? 0;

  const submit = async () => {
    if (!authed) return router.push({ pathname: '/login', params: { next: `/product/${slug}` } });
    if (draft.trim().length < 5) return Alert.alert('Please write at least 5 characters');
    try {
      await ask({ productId, question: draft.trim() }).unwrap();
      setDraft('');
      Alert.alert('Question sent', 'You will be notified when the seller answers.');
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };

  return (
    <>
      <Pressable onPress={() => setOpen(!open)} className="flex-row items-center gap-1.5">
        <Text className="text-xl font-bold text-ink-900">Questions about product</Text>
        <Text className="text-base text-ink-500">({total})</Text>
        <View className="flex-1" />
        {open ? <ChevronUp size={20} color={colors.ink} /> : <ChevronDown size={20} color={colors.ink} />}
      </Pressable>
      {open ? (
        <>
          <View className="mt-3 flex-row items-center rounded-lg border border-ink-200 pl-3">
            <TextInput value={draft} onChangeText={setDraft} placeholder="Write your question to seller" maxLength={500} className="h-12 flex-1 text-base" />
            <Pressable onPress={() => void submit()} disabled={askState.isLoading} className="m-1 rounded-md bg-accent-50 px-3 py-2.5">
              <Text className="font-semibold text-accent-700">{askState.isLoading ? 'Sending…' : 'Ask Question'}</Text>
            </Pressable>
          </View>
          {data?.items.length ? (
            data.items.map((q) => (
              <View key={q.id} className="mt-4 gap-2">
                <View className="flex-row gap-2">
                  <View className="size-6 items-center justify-center rounded bg-accent-500">
                    <Text className="text-xs font-bold text-white">Q</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base text-ink-900">{q.question}</Text>
                    <Text className="text-xs text-ink-400">
                      {q.askedBy.name} · {fmtDate(q.createdAt)}
                    </Text>
                  </View>
                </View>
                {q.answer ? (
                  <View className="flex-row gap-2">
                    <View className="size-6 items-center justify-center rounded bg-primary-700">
                      <Text className="text-xs font-bold text-white">A</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base text-ink-700">{q.answer}</Text>
                      <Text className="text-xs text-ink-400">{q.answeredBy?.name ?? 'Seller'}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Text className="mt-3 text-base text-ink-500">No questions yet</Text>
          )}
          {total > limit ? <ViewAll label="View All Questions" onPress={() => setLimit((n) => n + 5)} /> : null}
        </>
      ) : null}
    </>
  );
}

/** Side-by-side comparison of this product with similar ones. */
function CompareTable({ product, price, others, showSeller }: { product: ProductDetail; price: number; others: ProductCardData[]; showSeller: boolean }) {
  const { money, pick } = useI18n();
  const columns: { p: ProductCardData; self: boolean; price: number }[] = [
    { p: product, self: true, price },
    ...others.slice(0, 6).map((p) => ({ p, self: false, price: p.price })),
  ];
  const Cell = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <View className={`min-h-[52px] justify-center border-b border-r border-ink-100 px-2.5 py-2 ${className}`}>{children}</View>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {columns.map(({ p, self, price: colPrice }) => (
        <View key={p.id} style={{ width: 160 }}>
          <Pressable disabled={self} onPress={() => router.push(`/product/${p.slug}`)}>
            <Image source={img(p.imageUrl, 160)} style={{ width: 160, height: 160 }} contentFit="cover" />
            {self ? (
              <View className="absolute left-0 top-0 rounded-br-lg bg-primary-50 px-2 py-0.5">
                <Text className="text-sm text-primary-800">This Product</Text>
              </View>
            ) : null}
          </Pressable>
          <Cell>
            <Text numberOfLines={2} className={`text-sm ${self ? 'text-ink-900' : 'text-primary-700'}`}>
              {pick(p.title, p.titleBn)}
            </Text>
          </Cell>
          <Cell>{p.ratingCount > 0 ? <Text className="text-sm text-ink-800">★ {p.ratingAvg.toFixed(1)} <Text className="text-ink-400">({p.ratingCount})</Text></Text> : <Text className="text-sm text-ink-400">No ratings</Text>}</Cell>
          <Cell>
            <Text className="text-base font-bold text-accent-600">{money(colPrice)}</Text>
          </Cell>
          {showSeller ? (
            <Cell>
              <Text className="text-xs text-ink-500">sold by:</Text>
              <Text numberOfLines={1} className="font-semibold text-ink-900">{p.seller?.shopName ?? '—'}</Text>
            </Cell>
          ) : null}
          <CompareAdd product={p} self={self} />
        </View>
      ))}
    </ScrollView>
  );
}

function CompareAdd({ product, self }: { product: ProductCardData; self: boolean }) {
  const { t } = useI18n();
  const { onAdd } = useCardAddToCart(product);
  return (
    <View className="border-r border-ink-100 p-2">
      <Pressable
        onPress={() => (self ? Alert.alert('You are viewing this product', 'Use the Add to Cart button below.') : void onAdd())}
        className="h-10 flex-row items-center justify-center gap-1.5 rounded-lg bg-primary-50"
      >
        <Text className="font-semibold text-primary-800">{t.product.addToCart}</Text>
        <ShoppingCart size={16} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, money, pick } = useI18n();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { showSellerInfo } = useMarketplaceMode();
  const { data: settings } = usePublicSettingsQuery();
  const { data: product, isLoading, isError, refetch } = useProductQuery(slug);
  const { data: related = [] } = useRelatedProductsQuery(slug);
  const { data: together = [] } = useBoughtTogetherQuery(slug);
  const { data: storeProducts } = useProductsQuery(
    { seller: product?.seller?.slug, limit: 10, sort: 'popular' },
    { skip: !showSellerInfo || !product?.seller },
  );
  const [selection, setSelection] = useState<Record<string, string> | null>(null);
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<SectionId>('overview');
  const { add, isLoading: adding } = useAddToCart();
  const [startChat, chatState] = useStartConversationMutation();
  const wishlist = useWishlistToggle(product?.id ?? '');
  const scroll = useRef<ScrollView>(null);
  const tabsScroll = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<SectionId, number>>>({});
  const tabX = useRef<Partial<Record<SectionId, number>>>({});

  useEffect(() => {
    if (product) void rememberViewed(product);
  }, [product]);

  if (isError) return <ErrorView message={t.common.error} onRetry={() => void refetch()} />;
  if (isLoading || !product) return <Loading />;

  const initial = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const sel = selection ?? initial?.attributes ?? {};
  const variant = findVariant(product.variants, sel);
  const price = variant ? (variant.flash?.specialPrice ?? variant.price) : product.price;
  const compareAt = variant ? (variant.flash ? variant.price : variant.compareAtPrice) : product.compareAtPrice;
  const pct = discountPercent(price, compareAt);
  const stock = variant?.stock ?? 0;
  const storeOthers = (storeProducts?.items ?? []).filter((p) => p.id !== product.id);
  const seller = showSellerInfo ? product.seller : null;
  const sections: SectionId[] = ['overview', 'specs', 'details', 'reviews', 'questions', ...(seller ? (['store'] as const) : []), ...(related.length ? (['similar'] as const) : []), 'deals'];
  const headerH = insets.top + 56;
  const stickyH = headerH + 48;

  const goTo = (id: SectionId) => {
    const y = offsets.current[id];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - stickyH + 2), animated: true });
  };
  const onScroll = (y: number) => {
    setScrolled(y > width * 0.75);
    let current: SectionId = 'overview';
    for (const id of sections) {
      const top = offsets.current[id];
      if (top !== undefined && top - stickyH <= y + 4) current = id;
    }
    if (current !== active) {
      setActive(current);
      const x = tabX.current[current];
      if (x !== undefined) tabsScroll.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
    }
  };

  const handleAdd = async (buyNow: boolean) => {
    if (!variant) return;
    const ok = await add(product, variant, qty);
    if (!ok) return Alert.alert(t.common.error);
    if (buyNow) router.push('/cart');
    else Alert.alert(t.product.added);
  };

  const highlights = highlightsOpen ? product.highlights : product.highlights.slice(0, 4);

  // Opens (or reuses) the thread with this product's shop, with the product attached to the first message.
  const openChat = async () => {
    if (!wishlist.authed) return router.push({ pathname: '/login', params: { next: `/product/${slug}` } });
    try {
      const conversation = await startChat({ productId: product.id }).unwrap();
      router.push({ pathname: '/chat/[id]', params: { id: conversation.id, product: product.slug } });
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />
      <ScrollView ref={scroll} onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)} scrollEventThrottle={32} contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}>
        {/* ── Overview ── */}
        <View onLayout={(e) => {
            offsets.current.overview = e.nativeEvent.layout.y;
          }}>
          <View style={{ paddingTop: headerH }} className="bg-white">
            <FlatList
              data={product.images}
              horizontal
              pagingEnabled
              keyExtractor={(i) => i.id}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item }) => <Image source={img(item.url, width)} style={{ width, height: width }} contentFit="cover" />}
            />
            {product.images.length > 1 ? (
              <View className="absolute bottom-3 right-3 rounded-full bg-ink-700/70 px-3 py-1">
                <Text className="font-semibold text-white">
                  {imageIndex + 1}/{product.images.length}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="bg-white px-4 pb-4 pt-3">
            {variant?.flash ? (
              <View className="mb-3 flex-row items-center justify-between rounded-lg bg-flash px-3 py-2">
                <View className="flex-row items-center gap-1">
                  <Zap size={16} color="#fff" fill="#fff" />
                  <Text className="font-bold text-white">{t.home.flashSale}</Text>
                </View>
                <Countdown endsAt={variant.flash.endsAt} />
              </View>
            ) : null}
            <View className="flex-row items-center justify-between">
              {product.brand ? (
                <Pressable onPress={() => router.push({ pathname: '/search', params: { brand: product.brand!.slug } })}>
                  <Text className="text-base font-medium text-info">{product.brand.name}</Text>
                </Pressable>
              ) : (
                <View />
              )}
              {product.ratingCount > 0 ? (
                <Pressable onPress={() => goTo('reviews')}>
                  <Text className="text-base text-ink-800">
                    {product.ratingAvg.toFixed(1)} <Text className="text-warning">★</Text> <Text className="text-primary-700">({product.ratingCount})</Text>
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Text className="mt-1.5 text-lg leading-6 text-ink-900">
              {seller ? <Text className="text-sm font-bold text-primary-700">{seller.isHouseStore ? '✓ Official  ' : '✓ Verified  '}</Text> : null}
              {pick(product.title, product.titleBn)}
            </Text>
            <View className="mt-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Text className="text-3xl font-bold text-accent-600">{money(price)}</Text>
                {compareAt && compareAt > price ? <Text className="text-base text-ink-400 line-through">{money(compareAt)}</Text> : null}
                {pct > 0 ? (
                  <View className="rounded-md bg-primary-600 px-2 py-0.5">
                    <Text className="font-bold text-white">-{pct}%</Text>
                  </View>
                ) : null}
              </View>
              <View className="flex-row gap-4">
                <Pressable
                  accessibilityLabel="Share"
                  hitSlop={8}
                  onPress={() => void Share.share({ message: `${pick(product.title, product.titleBn)} — ${money(price)}\nmarketbd://product/${product.slug}` })}
                >
                  <Share2 size={24} color={colors.ink} />
                </Pressable>
                <Pressable
                  accessibilityLabel={t.product.saveToWishlist}
                  hitSlop={8}
                  onPress={async () => {
                    if (!wishlist.authed) return router.push({ pathname: '/login', params: { next: `/product/${slug}` } });
                    try {
                      await wishlist.toggle();
                    } catch (e) {
                      Alert.alert(errorMessage(e));
                    }
                  }}
                >
                  <Heart size={24} color={wishlist.saved ? colors.accent : colors.ink} fill={wishlist.saved ? colors.accent : 'transparent'} />
                </Pressable>
              </View>
            </View>

            <View className="mt-3 border-t border-ink-100">
              <OptionPicker
                product={product}
                sel={sel}
                onPick={(key, value) => {
                  setSelection({ ...sel, [key]: value });
                  setQty(1);
                }}
              />
              <View className="gap-2 pt-3">
                <Text className="text-base text-ink-600">{t.product.quantity}:</Text>
                <View className="flex-row items-center gap-3">
                  <Stepper value={qty} max={Math.max(1, Math.min(stock, 20))} onChange={setQty} />
                  <Text className={`text-sm ${stock === 0 ? 'text-danger' : stock <= 5 ? 'font-semibold text-flash' : 'text-ink-500'}`}>
                    {stock === 0 ? t.common.outOfStock : stock <= 5 ? fill(t.product.onlyLeft, { n: stock }) : t.common.inStock}
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-3 border-t border-ink-100 pt-1">
              {settings ? (
                <InfoRow
                  icon={<Truck size={22} color={colors.primary} />}
                  title="Standard Delivery"
                  sub={`Inside Dhaka ${settings.shipping.insideDhakaEta} · Outside ${settings.shipping.outsideDhakaEta}`}
                  right={money(settings.shipping.insideDhaka)}
                />
              ) : null}
              {settings ? (
                <InfoRow
                  icon={<RotateCcw size={22} color={colors.primary} />}
                  title={settings.returns.days > 0 ? `${settings.returns.days} Days Returns` : 'No Returns'}
                  onPress={() => Alert.alert('Return policy', settings.returns.policy || t.product.cod)}
                />
              ) : null}
              <InfoRow icon={<ShieldCheck size={22} color={colors.primary} />} title={product.warranty ?? 'No Warranty'} />
            </View>
          </View>
          <Vouchers sellerId={product.seller?.id ?? null} slug={product.slug} />
        </View>

        {/* ── Specifications ── */}
        <View onLayout={(e) => {
            offsets.current.specs = e.nativeEvent.layout.y;
          }}>
          <Pressable onPress={() => setSpecsOpen(true)} className="mt-2.5 flex-row items-center justify-between bg-white px-4 py-4">
            <Text className="text-xl font-bold text-ink-700">{t.product.specifications}</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-accent-600">Brand, SKU, ETC</Text>
              <ChevronRight size={18} color={colors.accent} />
            </View>
          </Pressable>
        </View>

        {/* ── Product details ── */}
        <View onLayout={(e) => {
            offsets.current.details = e.nativeEvent.layout.y;
          }}>
          <Panel>
            <Text className="mb-2 border-b border-ink-100 pb-2 text-xl font-bold text-ink-700">Product Details</Text>
            <Text numberOfLines={detailsOpen ? undefined : 5} className="text-base leading-6 text-ink-800">
              {pick(product.description, product.descriptionBn)}
            </Text>
            <MoreToggle open={detailsOpen} onPress={() => setDetailsOpen(!detailsOpen)} />
          </Panel>
          {product.highlights.length ? (
            <Panel>
              <Text className="mb-2 border-b border-ink-100 pb-2 text-xl font-bold text-ink-700">Description</Text>
              {highlights.map((h) => (
                <View key={h} className="flex-row gap-2 py-0.5 pl-1">
                  <Text className="text-base text-ink-800">•</Text>
                  <Text className="flex-1 text-base leading-6 text-ink-800">{h}</Text>
                </View>
              ))}
              {product.highlights.length > 4 ? <MoreToggle open={highlightsOpen} onPress={() => setHighlightsOpen(!highlightsOpen)} /> : null}
            </Panel>
          ) : null}
        </View>

        {/* ── Reviews & questions ── */}
        <View onLayout={(e) => {
            offsets.current.reviews = e.nativeEvent.layout.y;
          }}>
          <Panel>
            <Reviews productId={product.id} />
          </Panel>
        </View>
        <View onLayout={(e) => {
            offsets.current.questions = e.nativeEvent.layout.y;
          }}>
          <Panel>
            <Questions productId={product.id} slug={product.slug} />
          </Panel>
        </View>

        {/* ── Store ── */}
        {seller ? (
          <View onLayout={(e) => {
            offsets.current.store = e.nativeEvent.layout.y;
          }}>
            <Panel className="gap-3">
              <Pressable onPress={() => router.push(`/shop/${seller.slug}`)} className="flex-row items-center gap-3">
                <Image source={img(seller.logoUrl, 64)} style={{ width: 64, height: 64, borderRadius: 10 }} />
                <View className="flex-1 gap-1">
                  <Text className="text-lg font-semibold text-ink-900">{seller.shopName}</Text>
                  <View className="self-start rounded bg-accent-500 px-2 py-0.5">
                    <Text className="text-[11px] font-bold uppercase text-white">{seller.isHouseStore ? 'Official Store' : 'Verified Store'}</Text>
                  </View>
                </View>
              </Pressable>
              {seller.ratingAvg > 0 ? (
                <View className="flex-row items-center gap-2">
                  <RatingPill value={seller.ratingAvg} />
                  <Text className="text-sm text-ink-600">seller rating</Text>
                </View>
              ) : null}
            </Panel>
            {storeOthers.length ? (
              <View className="bg-primary-50/50 py-4">
                <Text className="mb-3 text-center text-xl font-semibold text-primary-800">✦ More from this store ✦</Text>
                <ProductRail products={storeOthers} />
              </View>
            ) : null}
            <View className="bg-white px-4 py-3">
              <Pressable onPress={() => router.push(`/shop/${seller.slug}`)} className="flex-row items-center justify-center gap-1 rounded-lg border border-primary-600 py-3">
                <Text className="font-semibold text-primary-700">Visit Store</Text>
                <ChevronRight size={16} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {together.length ? (
          <Panel>
            <View className="mb-3 flex-row items-center gap-3">
              <Image source={img(product.images[0]?.url, 48)} style={{ width: 48, height: 48, borderRadius: 8 }} />
              <View className="flex-1">
                <Text className="text-xl font-bold text-ink-900">Frequently bought together</Text>
                <Text numberOfLines={1} className="text-sm text-ink-500">With {pick(product.title, product.titleBn)}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {together.map((p) => (
                <MiniProductCard key={p.id} product={p} />
              ))}
            </ScrollView>
          </Panel>
        ) : null}

        {/* ── Similar ── */}
        {related.length ? (
          <View onLayout={(e) => {
            offsets.current.similar = e.nativeEvent.layout.y;
          }}>
            <Panel className="px-0">
              <Text className="mb-3 px-4 text-xl font-bold text-ink-900">Similar Products</Text>
              <CompareTable product={product} price={price} others={related} showSeller={Boolean(seller)} />
            </Panel>
          </View>
        ) : null}

        {/* ── Deals ── */}
        <View onLayout={(e) => {
            offsets.current.deals = e.nativeEvent.layout.y;
          }} className="pt-4">
          <DealsGrid excludeIds={[product.id]} />
        </View>
      </ScrollView>

      {/* ── Header: floating buttons over the gallery, then a mini product bar + section tabs ── */}
      <View className={`absolute inset-x-0 top-0 ${scrolled ? 'bg-primary-50' : 'bg-transparent'}`} style={{ paddingTop: insets.top }}>
        <View className="h-14 flex-row items-center gap-2 px-2">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Back" className="size-10 items-center justify-center rounded-lg bg-white/70">
            <ChevronLeft size={26} color={colors.ink} />
          </Pressable>
          {scrolled ? (
            <View className="flex-1 flex-row items-center gap-2">
              <Image source={img(product.images[0]?.url, 40)} style={{ width: 40, height: 40, borderRadius: 6 }} />
              <View className="flex-1">
                <Text numberOfLines={1} className="text-sm text-ink-900">{pick(product.title, product.titleBn)}</Text>
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-bold text-accent-600">{money(price)}</Text>
                  {compareAt && compareAt > price ? <Text className="text-xs text-ink-400 line-through">{money(compareAt)}</Text> : null}
                  {pct > 0 ? (
                    <View className="rounded bg-primary-100 px-1">
                      <Text className="text-xs font-semibold text-primary-800">{pct}% off</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          ) : (
            <View className="flex-1" />
          )}
          <Pressable onPress={() => router.push('/search')} accessibilityLabel={t.common.searchPlaceholder} className="size-10 items-center justify-center rounded-lg bg-white/70">
            <Search size={22} color={colors.ink} />
          </Pressable>
          <CartIconButton />
        </View>
        {scrolled ? (
          <ScrollView ref={tabsScroll} horizontal showsHorizontalScrollIndicator={false} className="h-12 grow-0 bg-white" contentContainerStyle={{ paddingHorizontal: 12, gap: 22 }}>
            {sections.map((id) => (
              <Pressable
                key={id}
                onLayout={(e) => {
                  tabX.current[id] = e.nativeEvent.layout.x;
                }}
                onPress={() => goTo(id)}
                className={`h-12 justify-center border-b-2 ${active === id ? 'border-accent-500' : 'border-transparent'}`}
              >
                <Text className={`text-base ${active === id ? 'font-semibold text-accent-600' : 'text-ink-500'}`}>{TAB_LABEL[id]}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {/* ── Bottom action bar ── */}
      <View className="absolute inset-x-0 bottom-0 flex-row items-center gap-2 border-t border-ink-100 bg-white px-3 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
        {seller ? (
          <Pressable onPress={() => router.push(`/shop/${seller.slug}`)} className="w-12 items-center">
            {seller.logoUrl ? <Image source={img(seller.logoUrl, 28)} style={{ width: 28, height: 28, borderRadius: 4 }} /> : <Store size={24} color={colors.ink} />}
            <Text className="text-xs text-ink-700">Store</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void openChat()} disabled={chatState.isLoading} className="w-12 items-center" accessibilityLabel="Chat with seller">
          {chatState.isLoading ? <ActivityIndicator color={colors.primary} /> : <MessageCircle size={24} color={colors.ink} />}
          <Text className="text-xs text-ink-700">Chat</Text>
        </Pressable>
        <Pressable
          disabled={stock === 0 || adding}
          onPress={() => void handleAdd(false)}
          className={`h-14 flex-1 items-center justify-center rounded-xl bg-primary-50 ${stock === 0 ? 'opacity-50' : ''}`}
        >
          <Text className="text-lg font-semibold text-primary-800">{t.product.addToCart}</Text>
        </Pressable>
        <Pressable
          disabled={stock === 0 || adding}
          onPress={() => void handleAdd(true)}
          className={`h-14 flex-1 items-center justify-center rounded-xl bg-accent-500 ${stock === 0 ? 'opacity-50' : ''}`}
        >
          <Text className="text-lg font-semibold text-white">{stock === 0 ? t.common.outOfStock : t.product.buyNow}</Text>
        </Pressable>
      </View>

      <SpecsModal product={product} sku={variant?.sku ?? product.variants[0]?.sku} open={specsOpen} onClose={() => setSpecsOpen(false)} />
    </View>
  );
}
