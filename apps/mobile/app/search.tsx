import { useSearchSuggestQuery } from '@marketbd/api-client';
import type { ProductSort } from '@marketbd/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ProductList } from '@/components/product-list';
import { SortBar } from '@/components/sort-bar';
import { colors } from '@/components/ui';
import { useI18n } from '@/i18n';

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; brand?: string }>();
  const { t } = useI18n();
  const [text, setText] = useState(params.q ?? '');
  const [query, setQuery] = useState(params.q ?? '');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<ProductSort>('relevance');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(text.trim()), 200);
    return () => clearTimeout(id);
  }, [text]);
  const { data: suggest } = useSearchSuggestQuery(debounced, { skip: debounced.length < 2 || debounced === query });
  const showResults = Boolean(query || params.brand);

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View className="h-9 w-64 flex-row items-center gap-2 rounded-md bg-white px-2">
              <Search size={16} color={colors.muted} />
              <TextInput
                autoFocus={!params.q}
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => setQuery(text.trim())}
                returnKeyType="search"
                placeholder={t.common.searchPlaceholder}
                className="flex-1 text-sm"
              />
            </View>
          ),
        }}
      />
      {suggest && debounced !== query && debounced.length >= 2 ? (
        <View className="bg-white">
          {suggest.keywords.map((k) => (
            <Pressable key={k} onPress={() => { setText(k); setQuery(k); }} className="flex-row items-center gap-2 border-b border-ink-100 px-4 py-3">
              <Search size={14} color={colors.muted} />
              <Text className="text-sm">{k}</Text>
            </Pressable>
          ))}
          {suggest.products.slice(0, 4).map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`/product/${p.slug}`)} className="border-b border-ink-100 px-4 py-3">
              <Text numberOfLines={1} className="text-sm text-primary-700">{p.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {showResults ? (
        <ProductList key={`${query}-${params.brand ?? ''}-${sort}`} params={{ q: query || undefined, brand: params.brand, sort }} header={<SortBar value={sort} onChange={setSort} />} />
      ) : null}
    </View>
  );
}
