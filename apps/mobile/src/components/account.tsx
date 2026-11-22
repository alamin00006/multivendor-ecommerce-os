import { errorMessage, selectUser, useCollectCouponMutation } from '@marketbd/api-client';
import type { CouponView } from '@marketbd/shared';
import { router } from 'expo-router';
import { Mail, Phone, Ticket, X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { colors } from '@/components/ui';
import { useI18n } from '@/i18n';
import { voucherAmount, voucherKind } from '@/lib/vouchers';

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** Underlined, horizontally scrolling tabs (cartup account style). */
export function UnderlineTabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View className="border-b border-ink-100 bg-white">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
        {tabs.map((t) => {
          const on = t.key === value;
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} className={`border-b-2 px-3 py-3 ${on ? 'border-primary-700' : 'border-transparent'}`}>
              <Text className={`text-sm ${on ? 'font-semibold text-primary-700' : 'text-ink-500'}`}>
                {t.label}
                {t.count ? ` (${t.count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Bottom sheet with a title and close button. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <View className="max-h-[85%] rounded-t-2xl bg-white" style={{ paddingBottom: insets.bottom + 12 }}>
          <View className="flex-row items-center justify-between border-b border-ink-100 px-4 py-3">
            <Text className="text-base font-semibold text-ink-900">{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={22} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Collect for voucher cards: guests sign in first; remembers which card is busy. */
export function useCollect(next: string) {
  const user = useSelector(selectUser);
  const [collect] = useCollectCouponMutation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const onCollect = async (id: string) => {
    if (!user) return router.push({ pathname: '/login', params: { next } });
    setBusyId(id);
    try {
      await collect(id).unwrap();
    } catch (e) {
      Alert.alert(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };
  return { onCollect, busyId };
}

/** Where "Use Now" goes: the shop for store vouchers, otherwise the cart. */
const voucherHref = (v: CouponView) => (v.scope === 'STORE' && v.seller ? (`/shop/${v.seller.slug}` as const) : ('/cart' as const));

/** Full-width voucher ticket with Collect / Use Now. */
export function VoucherCard({ v, onCollect, busy, note }: { v: CouponView; onCollect?: () => void; busy?: boolean; note?: string }) {
  const { money } = useI18n();
  return (
    <View className="rounded-xl border-2 border-accent-300 bg-accent-50">
      <View className="flex-row gap-3 p-3">
        <View className="size-12 items-center justify-center rounded-lg bg-accent-500">
          <Ticket size={24} color="#fff" />
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-sm font-semibold text-ink-700">{voucherKind(v)}</Text>
          <Text className="text-xl font-bold text-accent-700">{voucherAmount(v, money)}</Text>
          <Text className="text-xs text-ink-500">
            Min. Spend {money(v.minOrderAmount)}
            {v.maxDiscount ? ` · Capped at ${money(v.maxDiscount)}` : ''}
          </Text>
          <Text className="mt-0.5 font-mono text-[11px] text-ink-400">{v.code}</Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between border-t border-dashed border-accent-300 px-3 py-2">
        <Text className="text-xs text-ink-500">{note ?? `Valid until ${fmtDate(v.endsAt)}`}</Text>
        {v.collected || !onCollect ? (
          <Pressable onPress={() => router.push(voucherHref(v))} className="rounded-md border border-accent-600 bg-white px-4 py-1.5">
            <Text className="font-semibold text-accent-700">Use Now</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onCollect} disabled={busy} className="min-w-20 items-center rounded-md bg-accent-600 px-4 py-1.5">
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text className="font-semibold text-white">Collect</Text>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Small centred card for empty lists, with an optional "Start Shopping" button. */
export function EmptyCard({ icon, title, text, shop = true }: { icon: ReactNode; title: string; text?: string; shop?: boolean }) {
  return (
    <View className="m-4 items-center gap-2 rounded-xl bg-white px-6 py-10">
      {icon}
      <Text className="text-center text-base font-semibold text-ink-900">{title}</Text>
      {text ? <Text className="text-center text-sm text-ink-500">{text}</Text> : null}
      {shop ? (
        <Pressable onPress={() => router.push('/')} className="mt-2 rounded-lg bg-primary-700 px-6 py-2.5">
          <Text className="font-semibold text-white">Start Shopping</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Contact buttons (call / email) shared by the help screens. */
export function ContactCard({ phone, email, hours }: { phone: string; email: string; hours: string }) {
  return (
    <View className="gap-2 rounded-xl bg-white p-4">
      <Text className="text-base font-bold text-ink-900">Contact us</Text>
      <Text className="text-xs text-ink-500">{hours}</Text>
      <View className="flex-row gap-2">
        <Pressable onPress={() => void Linking.openURL(`tel:${phone}`)} className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-primary-700 py-3">
          <Phone size={18} color="#fff" />
          <Text className="font-semibold text-white">Call</Text>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL(`mailto:${email}`)} className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-primary-700 py-3">
          <Mail size={18} color={colors.primary} />
          <Text className="font-semibold text-primary-700">Email</Text>
        </Pressable>
      </View>
    </View>
  );
}
