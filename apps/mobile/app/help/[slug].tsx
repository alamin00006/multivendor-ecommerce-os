import { usePublicSettingsQuery } from '@marketbd/api-client';
import { helpArticles, helpContext } from '@marketbd/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDown, CircleHelp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ContactCard } from '@/components/account';
import { colors, Empty } from '@/components/ui';

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="border-b border-ink-100">
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} className="flex-row items-center gap-3 px-4 py-3.5">
        <Text className="flex-1 text-sm font-medium text-ink-900">{q}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDown size={18} color={colors.muted} />
        </View>
      </Pressable>
      {open ? <Text className="px-4 pb-4 text-sm leading-5 text-ink-700">{a}</Text> : null}
    </View>
  );
}

/** One help topic, with expandable questions for the FAQ. */
export default function HelpArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: settings } = usePublicSettingsQuery();
  const ctx = helpContext(settings);
  const article = helpArticles(ctx).find((a) => a.slug === slug);
  if (!article) return <Empty icon={<CircleHelp size={48} color={colors.muted} />} title="Help topic not found" />;
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
      <Stack.Screen options={{ title: article.title }} />
      <View className="gap-2 rounded-xl bg-white p-4">
        {article.body.map((p) => (
          <Text key={p} className="text-sm leading-5 text-ink-700">
            {p}
          </Text>
        ))}
      </View>
      {article.faq ? (
        <View className="overflow-hidden rounded-xl bg-white">
          {article.faq.map((f) => (
            <Faq key={f.q} q={f.q} a={f.a} />
          ))}
        </View>
      ) : null}
      <ContactCard phone={ctx.supportPhone} email={ctx.supportEmail} hours={ctx.hours} />
    </ScrollView>
  );
}
