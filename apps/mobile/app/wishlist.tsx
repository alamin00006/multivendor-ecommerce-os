import { useWishlistQuery } from '@marketbd/api-client';
import { Stack } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { FlatList, RefreshControl, View } from 'react-native';
import { ProductCard } from '@/components/product-card';
import { colors, Empty, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function WishlistScreen() {
  const { t } = useI18n();
  const ready = useRequireAuth('/wishlist');
  const { data, isLoading, isFetching, refetch } = useWishlistQuery(undefined, { skip: !ready });
  if (!ready || isLoading) return <Loading />;
  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: t.common.wishlist }} />
      <FlatList
        data={data ?? []}
        keyExtractor={(w) => w.product.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: 12 }}
        contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
        renderItem={({ item }) => <ProductCard product={item.product} />}
        ListEmptyComponent={<Empty icon={<Heart size={48} color={colors.muted} />} title={t.account.emptyWishlist} />}
      />
    </View>
  );
}
