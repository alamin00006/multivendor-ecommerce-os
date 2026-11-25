import { usePublicSettingsQuery } from '@marketbd/api-client';
import { contentPages, helpContext, helpTopics } from '@marketbd/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDown, CircleHelp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ContactCard } from '@/components/account';
import { colors, Empty } from '@/components/ui';

function Question({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="border-b border-ink-100">
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} className="flex-row items-center gap-3 px-4 py-3.5">
        <Text className="flex-1 text-sm text-ink-900">{q}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDown size={18} color={colors.muted} />
        </View>
      </Pressable>
      {open ? <Text className="px-4 pb-4 text-sm leading-5 text-ink-700">{a}</Text> : null}
    </View>
  );
}

/** A Help Center topic (expandable questions) or a policy page (plain text). */
export default function HelpPageScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: settings } = usePublicSettingsQuery();
  const ctx = helpContext(settings);
  const topic = helpTopics(ctx).find((t) => t.slug === slug);
  const page = topic ? undefined : contentPages(ctx).find((p) => p.slug === slug);
  if (!topic && !page) return <Empty icon={<CircleHelp size={48} color={colors.muted} />} title="Help topic not found" />;

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
      <Stack.Screen options={{ title: topic?.title ?? page!.title }} />
      {topic ? (
        <View className="overflow-hidden rounded-xl bg-white">
          {topic.faq.map((f) => (
            <Question key={f.q} q={f.q} a={f.a} />
          ))}
        </View>
      ) : (
        <View className="gap-4 rounded-xl bg-white p-4">
          {page!.sections.map((s, i) => (
            <View key={s.heading ?? i} className="gap-2">
              {s.heading ? <Text className="text-xs font-bold uppercase tracking-wide text-ink-900">{s.heading}</Text> : null}
              {s.paragraphs.map((p) => (
                <Text key={p} className="text-sm leading-5 text-ink-700">
                  {p}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
      <ContactCard phone={ctx.supportPhone} email={ctx.supportEmail} hours={ctx.hours} />
    </ScrollView>
  );
}
