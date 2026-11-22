import { useCategoriesQuery } from '@marketbd/api-client';
import type { CategoryNode } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronRight, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { CartIconButton, colors, ErrorView, Loading, ScreenHeader } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';

function Circle({ node }: { node: CategoryNode }) {
  const { pick } = useI18n();
  return (
    <Pressable onPress={() => router.push(`/category/${node.slug}`)} className="mb-4 w-1/3 items-center gap-1.5 px-1">
      <View className="size-[72px] items-center justify-center overflow-hidden rounded-full bg-white">
        <Image source={img(node.iconUrl ?? node.imageUrl, 72)} style={{ width: 60, height: 60 }} contentFit="contain" />
      </View>
      <Text numberOfLines={2} className="text-center text-[13px] leading-4 text-ink-600">
        {pick(node.name, node.nameBn)}
      </Text>
    </Pressable>
  );
}

/** One titled block of category circles. */
function Section({ title, slug, nodes }: { title: string; slug: string; nodes: CategoryNode[] }) {
  return (
    <View className="border-b border-ink-100 pb-1 pt-3">
      <Pressable onPress={() => router.push(`/category/${slug}`)} className="mb-3 flex-row items-center justify-between pr-1">
        <Text className="text-lg font-medium text-ink-900">{title}</Text>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>
      <View className="flex-row flex-wrap">
        {nodes.map((n) => (
          <Circle key={n.id} node={n} />
        ))}
      </View>
    </View>
  );
}

export default function CategoriesScreen() {
  const { t, pick } = useI18n();
  const { data = [], isLoading, isError, isFetching, refetch } = useCategoriesQuery();
  const [active, setActive] = useState(0);
  const current = data[active];
  // Deep trees show one section per sub-category; two-level trees show the sub-categories in one section.
  const grouped = current?.children.some((c) => c.children.length > 0);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        back={false}
        title={t.common.categories}
        right={
          <View className="flex-row gap-2">
            <Pressable onPress={() => router.push('/search')} accessibilityLabel={t.common.searchPlaceholder} className="size-10 items-center justify-center rounded-lg bg-white/70">
              <Search size={22} color={colors.ink} />
            </Pressable>
            <CartIconButton />
          </View>
        }
      />
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorView message={t.common.error} onRetry={() => void refetch()} />
      ) : (
        <View className="flex-1 flex-row">
          <ScrollView className="w-[104px] grow-0 bg-white" showsVerticalScrollIndicator={false}>
            {data.map((c, i) => {
              const on = i === active;
              return (
                <Pressable key={c.id} onPress={() => setActive(i)} className={`items-center gap-1.5 border-b border-ink-100 px-1.5 py-3 ${on ? 'bg-white' : 'bg-ink-50'}`}>
                  {on ? <View className="absolute bottom-0 left-0 top-0 w-1 bg-accent-500" /> : null}
                  <View className="size-14 overflow-hidden rounded-full bg-white">
                    <Image source={img(c.iconUrl ?? c.imageUrl, 56)} style={{ width: 56, height: 56 }} contentFit="cover" />
                  </View>
                  <Text numberOfLines={2} className={`text-center text-xs ${on ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                    {pick(c.name, c.nameBn)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {current ? (
            <ScrollView
              className="flex-1 bg-canvas px-3"
              refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
            >
              {grouped ? (
                current.children.map((sub) =>
                  sub.children.length ? (
                    <Section key={sub.id} title={pick(sub.name, sub.nameBn)} slug={sub.slug} nodes={sub.children} />
                  ) : (
                    <Section key={sub.id} title={pick(sub.name, sub.nameBn)} slug={sub.slug} nodes={[sub]} />
                  ),
                )
              ) : (
                <Section title={pick(current.name, current.nameBn)} slug={current.slug} nodes={current.children} />
              )}
              <Pressable onPress={() => router.push(`/category/${current.slug}`)} className="my-4 items-center rounded-lg border border-primary-200 bg-white py-3">
                <Text className="font-semibold text-primary-700">
                  {t.common.seeAll} · {pick(current.name, current.nameBn)}
                </Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </View>
      )}
    </View>
  );
}
