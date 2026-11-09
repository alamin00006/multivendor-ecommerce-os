import {
  useActiveFlashSaleQuery,
  useBannersQuery,
  useCategoriesQuery,
  useQuickLinksQuery,
} from '@marketbd/api-client';
import { BRAND } from '@marketbd/shared';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Search, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Countdown } from '@/components/product-card';
import { ProductList } from '@/components/product-list';
import { colors, SectionTitle } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { linkHref } from '@/lib/links';

function HeroSlider() {
  const { width } = useWindowDimensions();
  const { data: banners = [] } = useBannersQuery('HOME_HERO');
  const [index, setIndex] = useState(0);
  const slideW = width - 24;
  if (!banners.length) return null;
  return (
    <View className="mx-3 overflow-hidden rounded-xl">
      <FlatList
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / slideW))}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              const href = linkHref(item.linkType, item.linkValue);
              if (href) router.push(href);
              else void WebBrowser.openBrowserAsync(item.linkValue);
            }}
          >
            <Image source={img(item.mobileImageUrl ?? item.imageUrl, slideW)} style={{ width: slideW, height: slideW / 2 }} contentFit="cover" />
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

function QuickLinks() {
  const { pick } = useI18n();
  const { data = [] } = useQuickLinksQuery();
  return (
    <FlatList
      data={data}
      horizontal
      keyExtractor={(q) => q.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
      renderItem={({ item }) => (
        <Pressable className="w-16 items-center gap-1" onPress={() => { const h = linkHref(item.linkType, item.linkValue); if (h) router.push(h); }}>
          <Image source={img(item.iconUrl, 56)} style={{ width: 56, height: 56, borderRadius: 16 }} />
          <Text numberOfLines={2} className="text-center text-[11px] text-ink-700">{pick(item.label, item.labelBn)}</Text>
        </Pressable>
      )}
    />
  );
}

function FlashSale() {
  const { t, money, pick } = useI18n();
  const { data: sale } = useActiveFlashSaleQuery();
  if (!sale || !sale.items.length) return null;
  return (
    <View className="mx-3 rounded-xl bg-white p-3">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Zap size={18} color={colors.flash} fill={colors.flash} />
          <Text className="text-base font-bold text-flash">{t.home.flashSale}</Text>
          <Countdown endsAt={sale.endAt} />
        </View>
        <Link href="/flash-sale" className="text-xs font-semibold text-flash">{t.common.seeAll}</Link>
      </View>
      <FlatList
        data={sale.items}
        horizontal
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => {
          const pct = Math.min(100, (item.soldCount / item.stockLimit) * 100);
          const left = item.stockLimit - item.soldCount;
          return (
            <Pressable className="w-28" onPress={() => router.push(`/product/${item.product.slug}`)}>
              <Image source={img(item.product.imageUrl, 112)} style={{ width: 112, height: 112, borderRadius: 8 }} />
              <Text numberOfLines={1} className="mt-1 text-[11px] text-ink-700">{pick(item.product.title, item.product.titleBn)}</Text>
              <Text className="text-sm font-bold text-flash">{money(item.specialPrice)}</Text>
              <Text className="text-[10px] text-ink-400 line-through">{money(item.regularPrice)}</Text>
              <View className="mt-1 h-3.5 overflow-hidden rounded-full bg-red-100">
                <View className="h-full rounded-full bg-flash" style={{ width: `${pct}%` }} />
                <Text className="absolute w-full text-center text-[9px] font-semibold text-ink-900">
                  {left <= 5 ? t.common.limitedStock : `${item.soldCount} ${t.common.sold}`}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function CategoryGrid() {
  const { t, pick } = useI18n();
  const { data = [] } = useCategoriesQuery();
  return (
    <View className="mx-3">
      <SectionTitle title={t.home.recommendedCategories} action={<Link href="/categories" className="text-xs font-semibold text-primary-700">{t.common.seeAll}</Link>} />
      <View className="flex-row flex-wrap gap-2">
        {data.slice(0, 8).map((c) => (
          <Pressable key={c.id} className="w-[23%] items-center gap-1 rounded-lg bg-white p-2" onPress={() => router.push(`/category/${c.slug}`)}>
            <Image source={img(c.imageUrl, 64)} style={{ width: '100%', aspectRatio: 1, borderRadius: 6 }} />
            <Text numberOfLines={2} className="text-center text-[10px] text-ink-700">{pick(c.name, c.nameBn)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();
  const header = (
    <View className="gap-4 pb-2">
      <HeroSlider />
      <QuickLinks />
      <FlashSale />
      <CategoryGrid />
      <Text className="mx-3 text-lg font-bold text-ink-900">{t.home.dealsForYou}</Text>
    </View>
  );
  return (
    <View className="flex-1 bg-canvas">
      <View className="bg-primary-700 px-3 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-white">{BRAND.name}</Text>
          <Pressable onPress={() => setLocale(locale === 'en' ? 'bn' : 'en')} className="rounded border border-white/60 px-2 py-0.5">
            <Text className="text-xs font-semibold text-white">{t.common.language}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.push('/search')} className="h-10 flex-row items-center gap-2 rounded-lg bg-white px-3">
          <Search size={18} color={colors.muted} />
          <Text className="text-sm text-ink-400">{t.common.searchPlaceholder}</Text>
        </Pressable>
      </View>
      <ProductList params={{ sort: 'popular' }} header={header} />
    </View>
  );
}
