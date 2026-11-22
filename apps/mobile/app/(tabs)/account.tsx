import { selectAuth, useLogoutMutation, useOrdersQuery, usePendingReviewsQuery, useUnreadCountQuery } from '@marketbd/api-client';
import { BANGLA_ENABLED } from '@marketbd/shared';
import { router, type Href } from 'expo-router';
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Globe,
  Heart,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  PackageCheck,
  PackageX,
  RotateCcw,
  Star,
  Ticket,
  Truck,
  User,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Button, colors, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';

type Icon = ComponentType<{ size: number; color: string }>;

function Row({ icon: Icon, label, hint, href, badge, onPress }: { icon: Icon; label: string; hint?: string; href?: Href; badge?: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress ?? (() => href && router.push(href))} className="flex-row items-center gap-3 border-b border-ink-100 px-4 py-3.5 last:border-b-0">
      <Icon size={20} color={colors.primary} />
      <View className="flex-1">
        <Text className="text-sm text-ink-800">{label}</Text>
        {hint ? <Text className="text-xs text-ink-400">{hint}</Text> : null}
      </View>
      {badge ? (
        <View className="rounded-full bg-accent-500 px-2 py-0.5">
          <Text className="text-[10px] font-bold text-white">{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

function Group({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View className="mx-3 mt-3 overflow-hidden rounded-xl bg-white">
      <View className="flex-row items-center justify-between px-4 pb-1 pt-3">
        <Text className="text-base font-bold text-ink-900">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** Order shortcuts like the reference: To Pay / To Ship / Shipped / To Review. */
function OrderShortcut({ icon: Icon, label, count, href }: { icon: Icon; label: string; count?: number; href: Href }) {
  return (
    <Pressable onPress={() => router.push(href)} className="flex-1 items-center gap-1.5 py-3">
      <View>
        <Icon size={26} color={colors.ink} />
        {count ? (
          <View className="absolute -right-2.5 -top-1.5 min-w-4 items-center rounded-full bg-accent-500 px-1">
            <Text className="text-[10px] font-bold text-white">{count > 9 ? '9+' : count}</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-xs text-ink-700">{label}</Text>
    </Pressable>
  );
}

/** Account tab: "Manage My Account" with order shortcuts and every account page. */
export default function AccountScreen() {
  const { t, locale, setLocale } = useI18n();
  const { user, status } = useSelector(selectAuth);
  const authed = status === 'authenticated';
  const [logout, logoutState] = useLogoutMutation();
  const { data: unread } = useUnreadCountQuery(undefined, { skip: !authed, pollingInterval: 60_000 });
  const toPay = useOrdersQuery({ toPay: true, limit: 1 }, { skip: !authed });
  const toShip = useOrdersQuery({ status: 'PROCESSING', limit: 1 }, { skip: !authed });
  const shipped = useOrdersQuery({ status: 'SHIPPED', limit: 1 }, { skip: !authed });
  const toReview = usePendingReviewsQuery(undefined, { skip: !authed });

  if (status === 'idle' || status === 'restoring') return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <View className="bg-primary-700 px-4 py-6">
        {user ? (
          <Pressable onPress={() => router.push('/profile')} className="flex-row items-center gap-3">
            <View className="size-14 items-center justify-center rounded-full bg-white/20">
              <User size={28} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-white">{user.name}</Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-primary-100">{user.email ?? user.phone}</Text>
                {user.emailVerified || user.phoneVerified ? <BadgeCheck size={14} color="#fff" /> : null}
              </View>
            </View>
            <ChevronRight size={20} color="#fff" />
          </Pressable>
        ) : (
          <View className="gap-3">
            <Text className="text-lg font-bold text-white">{t.auth.welcome}</Text>
            <View className="flex-row gap-3">
              <Button title={t.common.signIn} variant="accent" className="flex-1" onPress={() => router.push('/login')} />
              <Button title={t.common.signUp} variant="outline" className="flex-1" onPress={() => router.push('/register')} />
            </View>
          </View>
        )}
      </View>

      {user ? (
        <>
          <Group
            title="My Orders"
            action={
              <Pressable onPress={() => router.push('/orders')} hitSlop={8} className="flex-row items-center">
                <Text className="text-xs text-ink-500">View all</Text>
                <ChevronRight size={14} color={colors.muted} />
              </Pressable>
            }
          >
            <View className="flex-row">
              <OrderShortcut icon={Wallet} label="To Pay" count={toPay.data?.meta.total} href="/orders?tab=to-pay" />
              <OrderShortcut icon={Package} label="To Ship" count={toShip.data?.meta.total} href="/orders?tab=to-ship" />
              <OrderShortcut icon={Truck} label="Shipped" count={shipped.data?.meta.total} href="/orders?tab=shipped" />
              <OrderShortcut icon={Star} label="To Review" count={toReview.data?.length} href="/reviews" />
            </View>
            <View className="border-t border-ink-100">
              <Row icon={RotateCcw} label="My Returns" href="/returns" />
              <Row icon={PackageX} label="My Cancellations" href="/cancellations" />
              <Row icon={PackageCheck} label="My Reviews" href="/reviews" />
            </View>
          </Group>

          <Group title="Manage My Account">
            <Row icon={UserRound} label="My Profile" hint="Name, birthday, gender" href="/profile" />
            <Row icon={MapPin} label={t.account.addresses} href="/addresses" />
          </Group>

          <Group title="Vouchers & Wishlist">
            <Row icon={Ticket} label="Voucher Center" hint="Collect vouchers for your next order" href="/vouchers" />
            <Row icon={Wallet} label="My Voucher" href="/my-vouchers" />
            <Row icon={Heart} label={t.common.wishlist} href="/wishlist" />
          </Group>

          <Group title="Inbox">
            <Row icon={Bell} label={t.common.notifications} href="/notifications" badge={unread?.count} />
            <Row icon={MessageSquare} label="Messages" href="/messages" />
          </Group>
        </>
      ) : (
        <Group title="Vouchers">
          <Row icon={Ticket} label="Voucher Center" hint="See today’s vouchers" href="/vouchers" />
        </Group>
      )}

      <View className="mx-3 mt-3 overflow-hidden rounded-xl bg-white">
        {BANGLA_ENABLED ? <Row icon={Globe} label={`${t.common.language} (${locale === 'en' ? 'English' : 'বাংলা'})`} onPress={() => setLocale(locale === 'en' ? 'bn' : 'en')} /> : null}
        {user ? <Row icon={LogOut} label={logoutState.isLoading ? t.common.loading : t.common.signOut} onPress={() => void logout()} /> : null}
      </View>
    </ScrollView>
  );
}
