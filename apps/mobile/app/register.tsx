import { zodResolver } from '@hookform/resolvers/zod';
import { errorMessage, useIsAuthenticated, useRegisterMutation } from '@marketbd/api-client';
import { type RegisterInput, RegisterSchema } from '@marketbd/shared';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput } from 'react-native';
import { Button } from '@/components/ui';
import { useI18n } from '@/i18n';

const inputClass = 'h-12 rounded-lg border border-ink-200 bg-white px-3 text-base';

export default function RegisterScreen() {
  const { t } = useI18n();
  const authed = useIsAuthenticated();
  const [registerUser, state] = useRegisterMutation();
  const { control, handleSubmit, formState } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  useEffect(() => {
    if (authed) router.replace('/account');
  }, [authed]);

  const fields: { name: keyof RegisterInput; placeholder: string; props?: object }[] = [
    { name: 'name', placeholder: t.auth.name, props: { autoComplete: 'name' } },
    { name: 'email', placeholder: t.auth.email, props: { autoCapitalize: 'none', keyboardType: 'email-address', autoComplete: 'email' } },
    { name: 'phone', placeholder: `${t.auth.phone} (01XXXXXXXXX)`, props: { keyboardType: 'phone-pad' } },
    { name: 'password', placeholder: t.auth.password, props: { secureTextEntry: true, autoComplete: 'new-password' } },
  ];

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t.common.signUp }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold">{t.auth.createAccount}</Text>
        {fields.map((f) => (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => (
              <>
                <TextInput className={inputClass} placeholder={f.placeholder} value={field.value ?? ''} onChangeText={(v) => field.onChange(v || undefined)} {...f.props} />
                {formState.errors[f.name] ? <Text className="text-xs text-red-600">{formState.errors[f.name]?.message}</Text> : null}
              </>
            )}
          />
        ))}
        {state.error ? <Text className="text-sm text-red-600">{errorMessage(state.error)}</Text> : null}
        <Button title={t.common.signUp} loading={state.isLoading} onPress={handleSubmit((v) => void registerUser(v))} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
