import { useCartCount } from '@marketbd/api-client';
import { router } from 'expo-router';
import { Check, ChevronLeft, ShoppingCart, Star } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/i18n';

export const colors = {
  primary: '#08755a',
  primaryDark: '#0b5d49',
  accent: '#f55a36',
  flash: '#ff3d57',
  ink: '#1f2430',
  muted: '#667391',
  border: '#d5d9e2',
  canvas: '#f3f5f7',
  warning: '#f59e0b',
  danger: '#dc2626',
};

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';

const variantClass: Record<Variant, { box: string; text: string }> = {
  primary: { box: 'bg-primary-700', text: 'text-white' },
  accent: { box: 'bg-accent-500', text: 'text-white' },
  outline: { box: 'border border-primary-700 bg-white', text: 'text-primary-700' },
  ghost: { box: 'bg-transparent', text: 'text-ink-700' },
  danger: { box: 'bg-red-600', text: 'text-white' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  className = '',
  icon,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
}) {
  const v = variantClass[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      className={`h-12 flex-row items-center justify-center gap-2 rounded-lg px-4 ${v.box} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.primary : '#fff'} /> : icon}
      <Text className={`font-semibold ${v.text}`}>{title}</Text>
    </Pressable>
  );
}

export function Price({ value, compareAt, large }: { value: number; compareAt?: number | null; large?: boolean }) {
  const { money } = useI18n();
  return (
    <View className="flex-row flex-wrap items-baseline gap-x-2">
      <Text className={`font-bold text-accent-600 ${large ? 'text-2xl' : 'text-sm'}`}>{money(value)}</Text>
      {compareAt && compareAt > value ? <Text className="text-xs text-ink-400 line-through">{money(compareAt)}</Text> : null}
    </View>
  );
}

export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={i <= Math.round(value) ? colors.warning : colors.border} fill={i <= Math.round(value) ? colors.warning : colors.border} />
      ))}
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' }) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    primary: 'bg-primary-50 text-primary-800',
  };
  const [bg, fg] = tones[tone].split(' ');
  return (
    <View className={`self-start rounded px-2 py-0.5 ${bg}`}>
      <Text className={`text-[11px] font-semibold ${fg}`}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <View className="items-center justify-center gap-3 px-8 py-16">
      {icon}
      <Text className="text-center text-lg font-semibold text-ink-800">{title}</Text>
      {text ? <Text className="text-center text-sm text-ink-500">{text}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <View className="m-4 items-center gap-3 rounded-lg bg-red-50 p-6">
      <Text className="text-center text-sm text-red-700">{message}</Text>
      {onRetry ? <Button title={t.common.retry} variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="text-lg font-bold text-ink-900">{title}</Text>
      {action}
    </View>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-xl bg-white p-4 ${className}`}>{children}</View>;
}

export function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <View className="h-9 flex-row items-center overflow-hidden rounded-md border border-ink-200">
      <Pressable className="h-full w-9 items-center justify-center" disabled={value <= 1} onPress={() => onChange(value - 1)} accessibilityLabel="Decrease">
        <Text className="text-lg text-ink-600">−</Text>
      </Pressable>
      <Text className="w-9 text-center font-semibold">{value}</Text>
      <Pressable className="h-full w-9 items-center justify-center" disabled={value >= max} onPress={() => onChange(value + 1)} accessibilityLabel="Increase">
        <Text className="text-lg text-ink-600">+</Text>
      </Pressable>
    </View>
  );
}

export function Checkbox({ checked, onPress, disabled, label }: { checked: boolean; onPress: () => void; disabled?: boolean; label?: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      className={`size-5 items-center justify-center rounded border-2 ${checked ? 'border-primary-700 bg-primary-700' : 'border-ink-300 bg-white'} ${disabled ? 'opacity-40' : ''}`}
    >
      {checked ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
    </Pressable>
  );
}

export function RadioDot({ checked }: { checked: boolean }) {
  return (
    <View className={`size-5 items-center justify-center rounded-full border-2 ${checked ? 'border-primary-700' : 'border-ink-300'}`}>
      {checked ? <View className="size-2.5 rounded-full bg-primary-700" /> : null}
    </View>
  );
}

/** Rating pill used on cards and section headers: "4.8 ★ | 56". */
export function RatingPill({ value, count }: { value: number; count?: number }) {
  return (
    <View className="flex-row items-center overflow-hidden rounded">
      <View className="flex-row items-center gap-0.5 bg-warning px-1.5 py-0.5">
        <Text className="text-[11px] font-bold text-white">{value.toFixed(1)}</Text>
        <Star size={9} color="#fff" fill="#fff" />
      </View>
      {count !== undefined ? (
        <View className="bg-ink-100 px-1.5 py-0.5">
          <Text className="text-[11px] text-ink-700">{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Cart icon with a quantity badge; opens the cart tab. */
export function CartIconButton() {
  const count = useCartCount();
  return (
    <Pressable onPress={() => router.push('/cart')} accessibilityLabel="Cart" className="size-10 items-center justify-center rounded-lg bg-white/70">
      <ShoppingCart size={22} color={colors.ink} />
      {count > 0 ? (
        <View className="absolute right-0.5 top-0.5 min-w-4 items-center rounded-full bg-accent-500 px-1">
          <Text className="text-[10px] font-bold text-white">{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Light header for inner screens: back arrow, then either a title or custom content (e.g. a search box),
 * and optional right-side actions. Replaces the native stack header so screens match the app design.
 */
export function ScreenHeader({ title, subtitle, children, right, back = true }: { title?: string; subtitle?: string; children?: ReactNode; right?: ReactNode; back?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-row items-center gap-2 bg-primary-50 px-3 pb-3" style={{ paddingTop: insets.top + 8 }}>
      {back ? (
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Back" hitSlop={10} className="size-9 items-center justify-center">
          <ChevronLeft size={26} color={colors.ink} />
        </Pressable>
      ) : null}
      {children ?? (
        <View className="flex-1 flex-row items-baseline gap-1.5">
          <Text numberOfLines={1} className="text-xl font-bold text-ink-900">{title}</Text>
          {subtitle ? <Text className="text-sm text-ink-500">{subtitle}</Text> : null}
        </View>
      )}
      {right}
    </View>
  );
}
