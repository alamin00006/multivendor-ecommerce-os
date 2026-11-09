import { useCategoryQuery } from '@marketbd/api-client';
import type { ProductSort } from '@marketbd/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ProductList } from '@/components/product-list';
import { SortBar } from '@/components/sort-bar';
import { useI18n } from '@/i18n';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { pick } = useI18n();
  const { data: category } = useCategoryQuery(slug);
  const [sort, setSort] = useState<ProductSort>('relevance');
  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: category ? pick(category.name, category.nameBn) : '' }} />
      <ProductList
        key={`${slug}-${sort}`}
        params={{ category: slug, sort }}
        header={
          <View>
            {category && category.children.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingTop: 8 }}>
                {category.children.map((c) => (
                  <Pressable key={c.id} onPress={() => router.push(`/category/${c.slug}`)} className="rounded-lg bg-white px-3 py-2">
                    <Text className="text-xs text-ink-700">{pick(c.name, c.nameBn)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <SortBar value={sort} onChange={setSort} />
          </View>
        }
      />
    </View>
  );
}
