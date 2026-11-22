import { useSearchSuggestQuery } from '@marketbd/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { defaultFilters, FilterBar, filterParams, type ListFilters } from '@/components/filter-bar';
import { ProductList } from '@/components/product-list';
import { CartIconButton, colors, ScreenHeader } from '@/components/ui';
import { useI18n } from '@/i18n';

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; brand?: string }>();
  const { t } = useI18n();
  const [text, setText] = useState(params.q ?? '');
  const [query, setQuery] = useState(params.q ?? '');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState<ListFilters>({ ...defaultFilters, brands: params.brand ? params.brand.split(',') : [] });
  useEffect(() => {
    const id = setTimeout(() => setDebounced(text.trim()), 200);
    return () => clearTimeout(id);
  }, [text]);
  const { data: suggest } = useSearchSuggestQuery(debounced, { skip: debounced.length < 2 || debounced === query });
  const showResults = Boolean(query || filters.brands.length);
  const listParams = { q: query || undefined, ...filterParams(filters) };

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader right={<CartIconButton />}>
        <View className="h-11 flex-1 flex-row items-center gap-2 rounded-lg bg-white px-3">
          <Search size={20} color={colors.muted} />
          <TextInput
            autoFocus={!params.q}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => setQuery(text.trim())}
            returnKeyType="search"
            placeholder={t.common.searchPlaceholder}
            className="flex-1 text-base"
          />
        </View>
      </ScreenHeader>
      {suggest && debounced !== query && debounced.length >= 2 ? (
        <View className="bg-white">
          {suggest.keywords.map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                setText(k);
                setQuery(k);
              }}
              className="flex-row items-center gap-2 border-b border-ink-100 px-4 py-3"
            >
              <Search size={14} color={colors.muted} />
              <Text className="text-sm">{k}</Text>
            </Pressable>
          ))}
          {suggest.products.slice(0, 4).map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`/product/${p.slug}`)} className="border-b border-ink-100 px-4 py-3">
              <Text numberOfLines={1} className="text-sm text-primary-700">
                {p.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {showResults ? (
        <>
          <FilterBar scope={{ q: query || undefined }} value={filters} onChange={setFilters} />
          <ProductList key={JSON.stringify(listParams)} params={listParams} />
        </>
      ) : null}
    </View>
  );
}
