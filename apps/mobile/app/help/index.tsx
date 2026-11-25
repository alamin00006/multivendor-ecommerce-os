import { usePublicSettingsQuery } from '@marketbd/api-client';
import { BRAND, contentPages, HELP_SHORTCUTS, type HelpShortcutKey, helpContext, helpTopics } from '@marketbd/shared';
import { type Href, router, Stack } from 'expo-router';
import { Bell, ChevronRight, CreditCard, FileText, KeyRound, MapPin, PackageSearch, PackageX, RotateCcw, UserRound } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ContactCard } from '@/components/account';
import { colors } from '@/components/ui';

type Icon = ComponentType<{ size: number; color: string; strokeWidth?: number }>;

/** Where each Help Center shortcut opens in the app. */
const SHORTCUTS: Record<HelpShortcutKey, { icon: Icon; href: Href }> = {
  profile: { icon: UserRound, href: '/profile' },
  'to-pay': { icon: CreditCard, href: '/orders?tab=to-pay' },
  addresses: { icon: MapPin, href: '/addresses' },
  orders: { icon: PackageSearch, href: '/orders' },
  cancel: { icon: PackageX, href: '/cancellations' },
  returns: { icon: RotateCcw, href: '/returns' },
  password: { icon: KeyRound, href: '/profile' },
  notifications: { icon: Bell, href: '/notifications' },
};

function Row({ title, onPress, icon }: { title: string; onPress: () => void; icon?: boolean }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 border-b border-ink-100 px-4 py-3.5">
      {icon ? <FileText size={18} color={colors.primary} /> : null}
      <Text className="flex-1 text-sm text-ink-800">{title}</Text>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

/** Help Center: greeting, account shortcuts, topics, policies and contact options. */
export default function HelpScreen() {
  const { data: settings } = usePublicSettingsQuery();
  const ctx = helpContext(settings);
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
      <Stack.Screen options={{ title: 'Help Center' }} />
      <View className="items-center rounded-xl bg-primary-700 px-4 py-5">
        <Text className="text-sm text-white">Welcome to {BRAND.name} Help Center</Text>
        <Text className="mt-0.5 text-xl font-semibold text-white">Hi, How can we help?</Text>
      </View>

      <View className="flex-row flex-wrap rounded-xl bg-white py-3">
        {HELP_SHORTCUTS.map((s) => {
          const { icon: Icon, href } = SHORTCUTS[s.key];
          return (
            <Pressable key={s.key} onPress={() => router.push(href)} className="w-1/4 items-center gap-1.5 px-1 py-2">
              <Icon size={26} color={colors.ink} strokeWidth={1.6} />
              <Text className="text-center text-[11px] leading-tight text-ink-700">{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="overflow-hidden rounded-xl bg-white">
        {helpTopics(ctx).map((t) => (
          <Row key={t.slug} title={t.title} onPress={() => router.push(`/help/${t.slug}`)} />
        ))}
      </View>

      <Text className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Policies</Text>
      <View className="overflow-hidden rounded-xl bg-white">
        {contentPages(ctx).map((p) => (
          <Row key={p.slug} icon title={p.title} onPress={() => router.push(`/help/${p.slug}`)} />
        ))}
      </View>

      <ContactCard phone={ctx.supportPhone} email={ctx.supportEmail} hours={ctx.hours} />
    </ScrollView>
  );
}
