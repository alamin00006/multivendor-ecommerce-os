import { zodResolver } from '@hookform/resolvers/zod';
import {
  errorMessage,
  useIsAuthenticated,
  useLoginMutation,
  useRequestOtpMutation,
  useVerifyOtpMutation,
} from '@marketbd/api-client';
import { BdPhoneSchema, fill, type LoginInput, LoginSchema } from '@marketbd/shared';
import { type Href, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui';
import { useI18n } from '@/i18n';

const inputClass = 'h-12 rounded-lg border border-ink-200 bg-white px-3 text-base';

function PasswordForm() {
  const { t } = useI18n();
  const [login, state] = useLoginMutation();
  const { control, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema), defaultValues: { email: '', password: '' } });
  return (
    <View className="gap-3">
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextInput className={inputClass} placeholder={t.auth.email} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={field.value} onChangeText={field.onChange} />
        )}
      />
      {formState.errors.email ? <Text className="text-xs text-red-600">{formState.errors.email.message}</Text> : null}
      <Controller
        control={control}
        name="password"
        render={({ field }) => <TextInput className={inputClass} placeholder={t.auth.password} secureTextEntry autoComplete="password" value={field.value} onChangeText={field.onChange} />}
      />
      {state.error ? <Text className="text-sm text-red-600">{errorMessage(state.error)}</Text> : null}
      <Button title={t.common.signIn} loading={state.isLoading} onPress={handleSubmit((v) => void login(v))} />
    </View>
  );
}

function OtpForm() {
  const { t } = useI18n();
  const [phone, setPhone] = useState('');
  const [normalized, setNormalized] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [requestOtp, requestState] = useRequestOtpMutation();
  const [verifyOtp, verifyState] = useVerifyOtpMutation();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const send = async () => {
    const parsed = BdPhoneSchema.safeParse(phone);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid number');
    setError(null);
    try {
      const res = await requestOtp({ phone: parsed.data }).unwrap();
      setNormalized(parsed.data);
      setCooldown(res.resendIn);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!normalized) {
    return (
      <View className="gap-3">
        <TextInput className={inputClass} placeholder="01XXXXXXXXX" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
        <Button title={t.auth.sendCode} loading={requestState.isLoading} onPress={() => void send()} />
      </View>
    );
  }
  return (
    <View className="gap-3">
      <Text className="text-sm text-ink-600">{fill(t.auth.codeSent, { phone: normalized })}</Text>
      <TextInput
        className={`${inputClass} text-center text-2xl tracking-[8px]`}
        keyboardType="number-pad"
        maxLength={6}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
      />
      {verifyState.error ? <Text className="text-sm text-red-600">{errorMessage(verifyState.error)}</Text> : null}
      <Button title={t.auth.verify} disabled={code.length !== 6} loading={verifyState.isLoading} onPress={() => void verifyOtp({ phone: normalized, code })} />
      <Pressable disabled={cooldown > 0} onPress={() => void send()}>
        <Text className={`text-center text-sm font-semibold ${cooldown > 0 ? 'text-ink-400' : 'text-primary-700'}`}>
          {cooldown > 0 ? fill(t.auth.resendIn, { s: cooldown }) : t.auth.resend}
        </Text>
      </Pressable>
    </View>
  );
}

export default function LoginScreen() {
  const { t } = useI18n();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const authed = useIsAuthenticated();
  const [mode, setMode] = useState<'password' | 'otp'>('otp');

  useEffect(() => {
    if (!authed) return;
    if (next && next.startsWith('/')) router.replace(next as Href);
    else router.back();
  }, [authed, next]);

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t.common.signIn }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold text-ink-900">{t.auth.welcome}</Text>
        <View className="flex-row rounded-lg bg-ink-100 p-1">
          {(['otp', 'password'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} className={`flex-1 rounded-md py-2 ${mode === m ? 'bg-white' : ''}`}>
              <Text className={`text-center text-sm font-semibold ${mode === m ? 'text-ink-900' : 'text-ink-500'}`}>{m === 'otp' ? t.auth.otpLogin : t.auth.passwordLogin}</Text>
            </Pressable>
          ))}
        </View>
        {mode === 'otp' ? <OtpForm /> : <PasswordForm />}
        <Pressable onPress={() => router.replace('/register')}>
          <Text className="text-center text-sm text-ink-600">
            {t.auth.noAccount} <Text className="font-semibold text-primary-700">{t.common.signUp}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
