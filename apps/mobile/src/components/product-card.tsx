import { useCountdown } from '@marketbd/api-client';
import type { ProductCard as ProductCardData } from '@marketbd/shared';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';
import { Stars } from './ui';

export function ProductCard({ product }: { product: ProductCardData }) {
  const { t, money, pick } = useI18n();
  const left = product.flash ? product.flash.stockLimit - product.flash.soldCount : null;
  return (
    <Link href={`/product/${product.slug}`} asChild>
      <Pressable className="flex-1 overflow-hidden rounded-lg bg-white">
        <View className="aspect-square bg-ink-50">
          <Image source={img(product.imageUrl, 200)} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
          {product.discountPercent > 0 ? (
            <View className="absolute left-0 top-2 rounded-r bg-accent-500 px-1.5 py-0.5">
              <Text className="text-[11px] font-bold text-white">-{product.discountPercent}%</Text>
            </View>
          ) : null}
          {!product.inStock ? (
            <View className="absolute inset-x-0 bottom-0 bg-black/60 py-1">
              <Text className="text-center text-[11px] font-semibold text-white">{t.common.outOfStock}</Text>
            </View>
          ) : null}
        </View>
        <View className="gap-1 p-2">
          <Text numberOfLines={2} className="min-h-[34px] text-[13px] leading-[17px] text-ink-800">
            {pick(product.title, product.titleBn)}
          </Text>
          <View className="flex-row flex-wrap items-baseline gap-x-1.5">
            <Text className="font-bold text-accent-600">{money(product.price)}</Text>
            {product.compareAtPrice ? <Text className="text-[11px] text-ink-400 line-through">{money(product.compareAtPrice)}</Text> : null}
          </View>
          <View className="flex-row items-center justify-between">
            {product.ratingCount > 0 ? <Stars value={product.ratingAvg} size={10} /> : <View />}
            {left !== null && left <= 5 ? (
              <Text className="text-[10px] font-semibold text-flash">{t.common.limitedStock}</Text>
            ) : product.soldCount > 0 ? (
              <Text className="text-[10px] text-ink-500">
                {product.soldCount} {t.common.sold}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export function Countdown({ endsAt }: { endsAt: string }) {
  const { days, hours, minutes, seconds } = useCountdown(endsAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const cells = [days * 24 + hours, minutes, seconds];
  return (
    <View className="flex-row items-center gap-1">
      {cells.map((v, i) => (
        <View key={i} className="flex-row items-center gap-1">
          <View className="min-w-7 rounded bg-flash px-1 py-0.5">
            <Text className="text-center text-xs font-bold text-white">{pad(v)}</Text>
          </View>
          {i < 2 ? <Text className="font-bold text-flash">:</Text> : null}
        </View>
      ))}
    </View>
  );
}
