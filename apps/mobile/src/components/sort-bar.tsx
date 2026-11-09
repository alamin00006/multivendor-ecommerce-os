import { PRODUCT_SORTS, type ProductSort } from '@marketbd/shared';
import { Pressable, ScrollView, Text } from 'react-native';
import { useI18n } from '@/i18n';

export function SortBar({ value, onChange }: { value: ProductSort; onChange: (s: ProductSort) => void }) {
  const { t } = useI18n();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
      {PRODUCT_SORTS.map((s) => (
        <Pressable key={s} onPress={() => onChange(s)} className={`rounded-full border px-3 py-1.5 ${value === s ? 'border-primary-700 bg-primary-700' : 'border-ink-200 bg-white'}`}>
          <Text className={`text-xs ${value === s ? 'font-semibold text-white' : 'text-ink-700'}`}>{t.listing.sort[s]}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
