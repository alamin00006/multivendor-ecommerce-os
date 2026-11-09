import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { Button, colors } from '@/components/ui';
import { useI18n } from '@/i18n';

/** Also the deep-link target marketbd://checkout/result after online payments. */
export default function CheckoutResultScreen() {
  const { t } = useI18n();
  const { status, order } = useLocalSearchParams<{ status?: string; order?: string }>();
  const ok = status === 'success';
  return (
    <View className="flex-1 items-center justify-center gap-4 p-6">
      <Stack.Screen options={{ title: t.checkout.title, headerBackVisible: false }} />
      {ok ? <CheckCircle2 size={72} color={colors.primary} /> : <XCircle size={72} color={colors.danger} />}
      <Text className="text-center text-xl font-bold">{ok ? t.checkout.successTitle : t.checkout.failedTitle}</Text>
      {!ok ? <Text className="text-center text-sm text-ink-600">{t.checkout.failedText}</Text> : null}
      {order ? <Button title={t.checkout.viewOrder} className="w-full" onPress={() => router.replace(`/orders/${order}`)} /> : null}
      <Button title={t.checkout.continueShopping} variant="outline" className="w-full" onPress={() => router.replace('/')} />
    </View>
  );
}
