import { useProductFeedQuery } from '@marketbd/api-client';
import type { ProductListQuery } from '@marketbd/shared';
import { PackageSearch } from 'lucide-react-native';
import { type ReactElement, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { useI18n } from '@/i18n';
import { ProductCard } from './product-card';
import { colors, Empty, ErrorView } from './ui';

/** Infinite 2-column product grid with pull-to-refresh. */
export function ProductList({ params, header }: { params: Omit<ProductListQuery, 'page' | 'limit'>; header?: ReactElement }) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const { data, isFetching, isError, refetch } = useProductFeedQuery({ ...params, page, limit: 20 });
  const hasMore = data ? data.meta.page < data.meta.totalPages : false;

  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 8, paddingHorizontal: 12 }}
      contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
      renderItem={({ item }) => <ProductCard product={item} />}
      ListHeaderComponent={header}
      onEndReachedThreshold={0.6}
      onEndReached={() => {
        if (hasMore && !isFetching && data) setPage(data.meta.page + 1);
      }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && page === 1}
          tintColor={colors.primary}
          onRefresh={() => {
            setPage(1);
            void refetch();
          }}
        />
      }
      ListEmptyComponent={
        isError ? (
          <ErrorView message={t.common.error} onRetry={() => void refetch()} />
        ) : isFetching ? null : (
          <Empty icon={<PackageSearch size={48} color={colors.muted} />} title={t.listing.noResults} text={t.listing.noResultsHint} />
        )
      }
      ListFooterComponent={
        <View className="py-4">
          {isFetching ? <ActivityIndicator color={colors.primary} /> : !hasMore && data?.items.length ? <Text className="text-center text-xs text-ink-400">{t.common.nothingMore}</Text> : null}
        </View>
      }
    />
  );
}
