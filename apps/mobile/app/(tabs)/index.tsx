import { useActiveFlashSaleQuery, useBannersQuery, useCategoriesQuery, useQuickLinksQuery } from '@marketbd/api-client';
import { BANGLA_ENABLED, type FlashSaleItemView } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowRight, ArrowUp, Search, ShoppingCart } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Countdown, DealsGrid, useCardAddToCart } from '@/components/product-card';
import { colors } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { linkHref } from '@/lib/links';

const openLink = (type: Parameters<typeof linkHref>[0], value: string) => {
  const href = linkHref(type, value);
  if (href) router.push(href);
  else void WebBrowser.openBrowserAsync(value);
};

/** Brand-colour header: search box and a row of category text tabs ("All" + root categories). */
function HomeHeader() {
  const insets = useSafeAreaInsets();
  const { t, pick, locale, setLocale } = useI18n();
  const { data: categories = [] } = useCategoriesQuery();
  return (
    <View className="bg-primary-700" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center gap-2 px-3">
        <Pressable onPress={() => router.push('/search')} className="h-12 flex-1 flex-row items-center rounded-xl bg-white pl-4 pr-1.5">
          <Text className="flex-1 text-base text-ink-400">{t.common.searchPlaceholder}</Text>
          <View className="size-9 items-center justify-center rounded-lg bg-primary-800">
            <Search size={20} color="#fff" />
          </View>
        </Pressable>
        {BANGLA_ENABLED ? (
          <Pressable onPress={() => setLocale(locale === 'en' ? 'bn' : 'en')} className="rounded border border-white/60 px-2 py-1">
            <Text className="text-xs font-semibold text-white">{t.common.language}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 22, paddingHorizontal: 14 }} className="mt-2">
        <View className="border-b-2 border-white pb-1.5 pt-1">
          <Text className="text-lg font-semibold text-white">All</Text>
        </View>
        {categories.map((c) => (
          <Pressable key={c.id} onPress={() => router.push(`/category/${c.slug}`)} className="pb-1.5 pt-1">
            <Text className="text-lg text-white/90">{pick(c.name, c.nameBn)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function HeroSlider() {
  const { width } = useWindowDimensions();
  const { data: banners = [] } = useBannersQuery('HOME_HERO');
  const [index, setIndex] = useState(0);
  if (!banners.length) return null;
  return (
    <View>
      <FlatList
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <Pressable onPress={() => openLink(item.linkType, item.linkValue)}>
            <Image source={img(item.mobileImageUrl ?? item.imageUrl, width)} style={{ width, height: width * 0.45 }} contentFit="cover" />
          </Pressable>
        )}
      />
      <View className="absolute bottom-2 w-full flex-row justify-center gap-1.5">
        {banners.map((b, i) => (
          <View key={b.id} className={`h-1.5 rounded-full ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`} />
        ))}
      </View>
    </View>
  );
}

/** Promo cards under the hero (mid-page banners), each with a caption strip. */
function PromoCards() {
  const { data: promos = [] } = useBannersQuery('HOME_MID');
  if (!promos.length) return null;
  return (
    <FlatList
      data={promos}
      horizontal
      keyExtractor={(b) => b.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingHorizontal: 12 }}
      renderItem={({ item }) => (
        <Pressable onPress={() => openLink(item.linkType, item.linkValue)} className="w-56 overflow-hidden rounded-xl bg-white">
          <Image source={img(item.mobileImageUrl ?? item.imageUrl, 224)} style={{ width: 224, height: 150 }} contentFit="cover" />
          <Text numberOfLines={2} className="px-2 py-2 text-center text-[15px] font-semibold text-ink-900">
            {item.title}
          </Text>
        </Pressable>
      )}
    />
  );
}

function QuickLinks() {
  const { pick } = useI18n();
  const { data = [] } = useQuickLinksQuery();
  if (!data.length) return null;
  return (
    <FlatList
      data={data}
      horizontal
      keyExtractor={(q) => q.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
      renderItem={({ item }) => (
        <Pressable className="w-[86px] items-center gap-1.5" onPress={() => openLink(item.linkType, item.linkValue)}>
          <View className="size-[86px] items-center justify-center rounded-xl bg-white">
            <Image source={img(item.iconUrl, 64)} style={{ width: 64, height: 64 }} contentFit="contain" />
          </View>
          <Text numberOfLines={2} className="text-center text-[13px] text-ink-800">
            {pick(item.label, item.labelBn)}
          </Text>
        </Pressable>
      )}
    />
  );
}

function FlashItem({ item }: { item: FlashSaleItemView }) {
  const { money, pick } = useI18n();
  const { onAdd } = useCardAddToCart(item.product);
  const save = item.regularPrice - item.specialPrice;
  return (
    <Pressable onPress={() => router.push(`/product/${item.product.slug}`)} className="w-44 overflow-hidden rounded-xl bg-white">
      <View>
        <Image source={img(item.product.imageUrl, 176)} style={{ width: 176, height: 150 }} contentFit="cover" />
        {save > 0 ? (
          <View className="absolute left-0 top-0 rounded-br-lg bg-green-100 px-2 py-0.5">
            <Text className="text-xs font-bold text-success">SAVE {money(save)}</Text>
          </View>
        ) : null}
      </View>
      <View className="gap-1 p-2">
        <Text numberOfLines={2} className="min-h-[36px] text-[13px] leading-[18px] text-ink-800">
          {pick(item.product.title, item.product.titleBn)}
        </Text>
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-base font-bold text-accent-600">{money(item.specialPrice)}</Text>
            <Text className="text-xs text-ink-400 line-through">{money(item.regularPrice)}</Text>
          </View>
          <Pressable onPress={() => void onAdd()} accessibilityLabel="Add to cart" className="size-9 items-center justify-center rounded-lg bg-primary-50">
            <ShoppingCart size={18} color={colors.primaryDark} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/** Flash sale strip: a title panel with a big countdown and "View All", then the sale items. */
function FlashSale() {
  const { t } = useI18n();
  const { data: sale } = useActiveFlashSaleQuery();
  if (!sale || !sale.items.length) return null;
  return (
    <View className="bg-primary-50 py-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 12 }}>
        <View className="w-48 items-center justify-center gap-3 rounded-xl bg-white p-3">
          <Text className="text-center text-3xl font-black italic text-flash">{t.home.flashSale.toUpperCase()}</Text>
          <Text className="font-bold text-ink-900">{t.home.dontMiss}!</Text>
          <Countdown endsAt={sale.endAt} boxed />
          <Pressable onPress={() => router.push('/flash-sale')} className="w-full flex-row items-center justify-center gap-1.5 rounded-lg bg-primary-700 py-2.5">
            <Text className="font-semibold text-white">{t.common.seeAll}</Text>
            <ArrowRight size={16} color="#fff" />
          </Pressable>
        </View>
        {sale.items.map((item) => (
          <FlashItem key={item.id} item={item} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const scroll = useRef<ScrollView>(null);
  const [showTop, setShowTop] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <View className="flex-1 bg-canvas">
      <HomeHeader />
      <ScrollView
        ref={scroll}
        onScroll={(e) => setShowTop(e.nativeEvent.contentOffset.y > 900)}
        scrollEventThrottle={64}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setRefreshKey((k) => k + 1)} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 24, gap: 14 }}
      >
        <HeroSlider />
        <PromoCards />
        <QuickLinks />
        <FlashSale />
        <DealsGrid key={refreshKey} />
      </ScrollView>
      {showTop ? (
        <Pressable
          onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })}
          accessibilityLabel="Back to top"
          className="absolute bottom-5 right-4 size-14 items-center justify-center rounded-full bg-ink-500/80"
        >
          <ArrowUp size={28} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}
