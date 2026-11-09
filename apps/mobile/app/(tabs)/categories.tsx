import { useCategoriesQuery } from '@marketbd/api-client';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { colors, ErrorView, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';

export default function CategoriesScreen() {
  const { t, pick } = useI18n();
  const { data = [], isLoading, isError, isFetching, refetch } = useCategoriesQuery();
  const [active, setActive] = useState(0);
  if (isLoading) return <Loading />;
  if (isError) return <ErrorView message={t.common.error} onRetry={() => void refetch()} />;
  const current = data[active];
  return (
    <View className="flex-1 flex-row bg-white">
      <ScrollView className="w-28 grow-0 bg-ink-50">
        {data.map((c, i) => (
          <Pressable key={c.id} onPress={() => setActive(i)} className={`px-3 py-4 ${i === active ? 'border-l-4 border-primary-700 bg-white' : ''}`}>
            <Text className={`text-xs ${i === active ? 'font-bold text-primary-800' : 'text-ink-600'}`}>{pick(c.name, c.nameBn)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {current ? (
        <ScrollView className="flex-1 p-3" refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}>
          <Pressable onPress={() => router.push(`/category/${current.slug}`)}>
            <Text className="mb-3 text-sm font-semibold text-primary-700">
              {pick(current.name, current.nameBn)} · {t.common.seeAll}
            </Text>
          </Pressable>
          <View className="flex-row flex-wrap">
            {current.children.map((sub) => (
              <Pressable key={sub.id} className="mb-4 w-1/3 items-center gap-1 px-1" onPress={() => router.push(`/category/${sub.slug}`)}>
                <Image source={img(sub.imageUrl, 80)} style={{ width: '100%', aspectRatio: 1, borderRadius: 8 }} />
                <Text numberOfLines={2} className="text-center text-[11px] text-ink-700">{pick(sub.name, sub.nameBn)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
