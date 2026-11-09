import { useActiveFlashSaleQuery } from '@marketbd/api-client';
import { Stack } from 'expo-router';
import { Zap } from 'lucide-react-native';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Countdown, ProductCard } from '@/components/product-card';
import { colors, Empty, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';

export default function FlashSaleScreen() {
  const { t } = useI18n();
  const { data: sale, isLoading, isFetching, refetch } = useActiveFlashSaleQuery();
  if (isLoading) return <Loading />;
  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: t.home.flashSale, headerStyle: { backgroundColor: colors.flash } }} />
      <FlatList
        data={sale?.items ?? []}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: 12 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.flash} />}
        ListHeaderComponent={
          sale ? (
            <View className="flex-row items-center justify-between bg-white px-3 py-3">
              <Text className="text-sm text-ink-600">{t.home.endsIn}</Text>
              <Countdown endsAt={sale.endAt} />
            </View>
          ) : null
        }
        renderItem={({ item }) => <ProductCard product={item.product} />}
        ListEmptyComponent={<Empty icon={<Zap size={48} color={colors.muted} />} title={t.listing.noResults} />}
      />
    </View>
  );
}
