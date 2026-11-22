import { useFacetsQuery } from '@marketbd/api-client';
import { PRODUCT_SORTS, type ProductListQuery, type ProductSort } from '@marketbd/shared';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useI18n } from '@/i18n';
import { colors } from './ui';

export interface ListFilters {
  sort: ProductSort;
  brands: string[];
}

export const defaultFilters: ListFilters = { sort: 'relevance', brands: [] };

type Panel = 'sort' | 'price' | 'brand' | null;
const PRICE_SORTS: ProductSort[] = ['price_asc', 'price_desc'];

function DropButton({ label, open, active, onPress }: { label: string; open: boolean; active: boolean; onPress: () => void }) {
  const on = open || active;
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <Pressable
      onPress={onPress}
      className={`h-12 flex-1 flex-row items-center justify-between rounded-lg border bg-white px-3 ${on ? 'border-accent-500' : 'border-ink-300'}`}
    >
      <Text numberOfLines={1} className={`flex-1 text-base ${on ? 'font-semibold text-accent-600' : 'text-ink-800'}`}>
        {label}
      </Text>
      <Icon size={18} color={on ? colors.accent : colors.ink} />
    </Pressable>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`rounded-lg px-4 py-2.5 ${on ? 'bg-primary-700' : 'bg-primary-50'}`}>
      <Text className={`text-base ${on ? 'font-semibold text-white' : 'text-primary-800'}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Sort By / Price / Brand dropdown row. Each button opens a chip row underneath; choices apply at once.
 * `scope` limits the brand list to the products being browsed.
 */
export function FilterBar({
  scope,
  value,
  onChange,
}: {
  scope: Pick<ProductListQuery, 'category' | 'seller' | 'campaign' | 'q'>;
  value: ListFilters;
  onChange: (next: ListFilters) => void;
}) {
  const { t } = useI18n();
  const [panel, setPanel] = useState<Panel>(null);
  const { data: facets } = useFacetsQuery(scope);
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const priceSort = PRICE_SORTS.includes(value.sort);
  const brands = facets?.brands ?? [];

  return (
    <View className="border-b border-ink-100 bg-white">
      <View className="flex-row gap-2.5 px-3 py-3">
        <DropButton label={!priceSort && value.sort !== 'relevance' ? t.listing.sort[value.sort] : 'Sort By'} open={panel === 'sort'} active={!priceSort && value.sort !== 'relevance'} onPress={() => toggle('sort')} />
        <DropButton label={t.listing.price} open={panel === 'price'} active={priceSort} onPress={() => toggle('price')} />
        <DropButton label={value.brands.length ? `${t.listing.brand} (${value.brands.length})` : t.listing.brand} open={panel === 'brand'} active={value.brands.length > 0} onPress={() => toggle('brand')} />
      </View>
      {panel === 'sort' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 12, paddingBottom: 12 }}>
          {PRODUCT_SORTS.filter((s) => !PRICE_SORTS.includes(s)).map((s) => (
            <Chip key={s} label={t.listing.sort[s]} on={value.sort === s} onPress={() => onChange({ ...value, sort: s })} />
          ))}
        </ScrollView>
      ) : null}
      {panel === 'price' ? (
        <View className="flex-row gap-2.5 px-3 pb-3">
          <Chip label="Low to High" on={value.sort === 'price_asc'} onPress={() => onChange({ ...value, sort: value.sort === 'price_asc' ? 'relevance' : 'price_asc' })} />
          <Chip label="High to Low" on={value.sort === 'price_desc'} onPress={() => onChange({ ...value, sort: value.sort === 'price_desc' ? 'relevance' : 'price_desc' })} />
        </View>
      ) : null}
      {panel === 'brand' ? (
        brands.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 12, paddingBottom: 12 }}>
            {brands.map((b) => {
              const on = value.brands.includes(b.slug);
              return (
                <Chip
                  key={b.slug}
                  label={b.name}
                  on={on}
                  onPress={() => onChange({ ...value, brands: on ? value.brands.filter((x) => x !== b.slug) : [...value.brands, b.slug] })}
                />
              );
            })}
          </ScrollView>
        ) : (
          <Text className="px-3 pb-3 text-sm text-ink-500">No brands in this list</Text>
        )
      ) : null}
    </View>
  );
}

/** Query params for ProductList from the filter state. */
export const filterParams = (f: ListFilters) => ({ sort: f.sort, brand: f.brands.length ? f.brands.join(',') : undefined });
