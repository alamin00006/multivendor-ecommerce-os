import { usePublicSettingsQuery } from '@marketbd/api-client';
import { helpArticles, helpContext, helpIntro } from '@marketbd/shared';
import { router, Stack } from 'expo-router';
import { ChevronRight, CircleHelp } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ContactCard } from '@/components/account';
import { colors } from '@/components/ui';

/** Help center: topics (FAQ first) and contact options. */
export default function HelpScreen() {
  const { data: settings } = usePublicSettingsQuery();
  const ctx = helpContext(settings);
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
      <Stack.Screen options={{ title: 'Help Center' }} />
      <View className="gap-1 rounded-xl bg-white p-4">
        {helpIntro(ctx).map((p) => (
          <Text key={p} className="text-sm leading-5 text-ink-700">
            {p}
          </Text>
        ))}
      </View>
      <View className="overflow-hidden rounded-xl bg-white">
        {helpArticles(ctx).map((a) => (
          <Pressable key={a.slug} onPress={() => router.push(`/help/${a.slug}`)} className="flex-row items-center gap-3 border-b border-ink-100 px-4 py-3.5">
            <CircleHelp size={20} color={colors.primary} />
            <Text className="flex-1 text-sm text-ink-800">{a.title}</Text>
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <ContactCard phone={ctx.supportPhone} email={ctx.supportEmail} hours={ctx.hours} />
    </ScrollView>
  );
}
