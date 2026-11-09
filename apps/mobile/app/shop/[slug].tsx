import { useMarketplaceMode, useShopQuery } from '@marketbd/api-client';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { ProductList } from '@/components/product-list';
import { ErrorView, Stars } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';

export default function ShopScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useI18n();
  const { multiVendor } = useMarketplaceMode();
  const { data: shop, isError } = useShopQuery(slug, { skip: !multiVendor });
  if (!multiVendor || isError) return <ErrorView message={t.common.notFound} />;
  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: shop?.shopName ?? '' }} />
      <ProductList
        params={{ seller: slug, sort: 'popular' }}
        header={
          shop ? (
            <View className="mb-2 flex-row items-center gap-3 bg-white p-4">
              <Image source={img(shop.logoUrl, 56)} style={{ width: 56, height: 56, borderRadius: 12 }} />
              <View className="flex-1">
                <Text className="text-lg font-bold">{shop.shopName}</Text>
                <View className="flex-row items-center gap-2">
                  <Stars value={shop.ratingAvg} />
                  <Text className="text-xs text-ink-500">{shop.productCount} products</Text>
                </View>
              </View>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}
