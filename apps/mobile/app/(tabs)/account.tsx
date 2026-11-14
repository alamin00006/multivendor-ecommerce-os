import { selectAuth, useLogoutMutation, useUnreadCountQuery } from '@marketbd/api-client';
import { BANGLA_ENABLED } from '@marketbd/shared';
import { router, type Href } from 'expo-router';
import {
  Bell,
  ChevronRight,
  Globe,
  Heart,
  LogOut,
  MapPin,
  Package,
  User,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Button, colors, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';

function Row({
  icon: Icon,
  label,
  href,
  badge,
  onPress,
}: {
  icon: ComponentType<{ size: number; color: string }>;
  label: string;
  href?: Href;
  badge?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress ?? (() => href && router.push(href))}
      className="flex-row items-center gap-3 border-b border-ink-100 bg-white px-4 py-4">
      <Icon size={20} color={colors.primary} />
      <Text className="flex-1 text-sm text-ink-800">{label}</Text>
      {badge ? (
        <View className="rounded-full bg-accent-500 px-2 py-0.5">
          <Text className="text-[10px] font-bold text-white">{badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function AccountScreen() {
  const { t, locale, setLocale } = useI18n();
  const { user, status } = useSelector(selectAuth);
  const [logout, logoutState] = useLogoutMutation();
  const { data: unread } = useUnreadCountQuery(undefined, {
    skip: status !== 'authenticated',
    pollingInterval: 60_000,
  });

  if (status === 'idle' || status === 'restoring') return <Loading />;

  return (
    <ScrollView>
      <View className="bg-primary-700 px-4 py-6">
        {user ? (
          <View className="flex-row items-center gap-3">
            <View className="size-14 items-center justify-center rounded-full bg-white/20">
              <User size={28} color="#fff" />
            </View>
            <View>
              <Text className="text-lg font-bold text-white">{user.name}</Text>
              <Text className="text-xs text-primary-100">{user.email ?? user.phone}</Text>
            </View>
          </View>
        ) : (
          <View className="gap-3">
            <Text className="text-lg font-bold text-white">{t.auth.welcome}</Text>
            <View className="flex-row gap-3">
              <Button
                title={t.common.signIn}
                variant="accent"
                className="flex-1"
                onPress={() => router.push('/login')}
              />
              <Button
                title={t.common.signUp}
                variant="outline"
                className="flex-1"
                onPress={() => router.push('/register')}
              />
            </View>
          </View>
        )}
      </View>
      {user ? (
        <View className="mt-3">
          <Row icon={Package} label={t.common.orders} href="/orders" />
          <Row icon={Heart} label={t.common.wishlist} href="/wishlist" />
          <Row icon={MapPin} label={t.account.addresses} href="/addresses" />
          <Row
            icon={Bell}
            label={t.common.notifications}
            href="/notifications"
            badge={unread?.count}
          />
        </View>
      ) : null}
      <View className="mt-3">
        {BANGLA_ENABLED ? (
          <Row
            icon={Globe}
            label={`${t.common.language} (${locale === 'en' ? 'English' : 'বাংলা'})`}
            onPress={() => setLocale(locale === 'en' ? 'bn' : 'en')}
          />
        ) : null}
        {user ? (
          <Row
            icon={LogOut}
            label={logoutState.isLoading ? t.common.loading : t.common.signOut}
            onPress={() => void logout()}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}
