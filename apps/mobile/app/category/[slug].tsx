import { useCategoryQuery } from '@marketbd/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { defaultFilters, FilterBar, filterParams, type ListFilters } from '@/components/filter-bar';
import { ProductList } from '@/components/product-list';
import { CartIconButton, colors, ScreenHeader } from '@/components/ui';
import { useI18n } from '@/i18n';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, pick } = useI18n();
  const { data: category } = useCategoryQuery(slug);
  const [filters, setFilters] = useState<ListFilters>(defaultFilters);
  const params = { category: slug, ...filterParams(filters) };

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader right={<CartIconButton />}>
        <Pressable onPress={() => router.push('/search')} className="h-11 flex-1 flex-row items-center gap-2 rounded-lg bg-white px-3">
          <Search size={20} color={colors.muted} />
          <Text numberOfLines={1} className="flex-1 text-base text-ink-400">
            {category ? `Search in ${pick(category.name, category.nameBn)}` : t.common.searchPlaceholder}
          </Text>
        </Pressable>
      </ScreenHeader>
      <FilterBar scope={{ category: slug }} value={filters} onChange={setFilters} />
      <ProductList
        key={JSON.stringify(params)}
        params={params}
        header={
          category && category.children.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 2 }}>
              {category.children.map((c) => (
                <Pressable key={c.id} onPress={() => router.push(`/category/${c.slug}`)} className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5">
                  <Text className="text-sm text-ink-700">{pick(c.name, c.nameBn)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : undefined
        }
      />
    </View>
  );
}
