'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  errorMessage,
  useIsAuthenticated,
  useLoginMutation,
  useRegisterMutation,
  useRequestOtpMutation,
  useVerifyOtpMutation,
} from '@marketbd/api-client';
import {
  BdPhoneSchema,
  type LoginInput,
  LoginSchema,
  type RegisterInput,
  RegisterSchema,
} from '@marketbd/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { fill } from '@/i18n';
import { useI18n } from '@/i18n/client';
import { Button, cn } from '@/components/ui';

/** Only allow same-site relative redirects after sign-in. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

function useRedirectWhenAuthed() {
  const authed = useIsAuthenticated();
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (authed) router.replace(safeNext(params.get('next')));
  }, [authed, router, params]);
}

function PasswordLogin() {
  const { t } = useI18n();
  const [login, state] = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });
  return (
    <form onSubmit={handleSubmit((v) => void login(v))} className="space-y-3" noValidate>
      <div>
        <label className="label" htmlFor="email">{t.auth.email}</label>
        <input id="email" type="email" className="input" autoComplete="email" {...register('email')} />
        {errors.email && <p className="field-error">{errors.email.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="password">{t.auth.password}</label>
        <input id="password" type="password" className="input" autoComplete="current-password" {...register('password')} />
        {errors.password && <p className="field-error">{errors.password.message}</p>}
      </div>
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-danger">{errorMessage(state.error)}</p>}
      <Button type="submit" block size="lg" loading={state.isLoading}>
        {t.common.signIn}
      </Button>
    </form>
  );
}

function OtpLogin() {
  const { t } = useI18n();
  const [phone, setPhone] = useState('');
  const [normalized, setNormalized] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
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
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message ?? 'Invalid number');
      return;
    }
    setPhoneError(null);
    try {
      const res = await requestOtp({ phone: parsed.data }).unwrap();
      setNormalized(parsed.data);
      setCooldown(res.resendIn);
    } catch (e) {
      setPhoneError(errorMessage(e));
    }
  };

  if (!normalized) {
    return (
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="phone">{t.auth.phone}</label>
          <input id="phone" className="input" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          {phoneError && <p className="field-error">{phoneError}</p>}
        </div>
        <Button block size="lg" loading={requestState.isLoading} onClick={() => void send()}>
          {t.auth.sendCode}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void verifyOtp({ phone: normalized, code });
      }}
    >
      <p className="text-sm text-ink-600">{fill(t.auth.codeSent, { phone: normalized })}</p>
      <input
        className="input text-center text-2xl tracking-[0.5em]"
        inputMode="numeric"
        maxLength={6}
        autoComplete="one-time-code"
        placeholder="••••••"
        aria-label={t.auth.code}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
      {verifyState.error && <p className="rounded bg-red-50 p-2 text-sm text-danger">{errorMessage(verifyState.error)}</p>}
      <Button type="submit" block size="lg" disabled={code.length !== 6} loading={verifyState.isLoading}>
        {t.auth.verify}
      </Button>
      <button type="button" disabled={cooldown > 0} onClick={() => void send()} className="w-full text-sm font-semibold text-primary-700 disabled:text-ink-400">
        {cooldown > 0 ? fill(t.auth.resendIn, { s: cooldown }) : t.auth.resend}
      </button>
    </form>
  );
}

export function LoginForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  useRedirectWhenAuthed();
  return (
    <div className="card mx-auto w-full max-w-md p-6">
      <h1 className="mb-4 font-display text-2xl font-bold">{t.auth.welcome}</h1>
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-ink-100 p-1 text-sm font-semibold">
        {(['password', 'otp'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn('rounded-md py-2', mode === m ? 'bg-white shadow' : 'text-ink-500')}>
            {m === 'password' ? t.auth.passwordLogin : t.auth.otpLogin}
          </button>
        ))}
      </div>
      {mode === 'password' ? <PasswordLogin /> : <OtpLogin />}
      <p className="mt-5 text-center text-sm text-ink-600">
        {t.auth.noAccount}{' '}
        <Link href={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-primary-700">
          {t.common.signUp}
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const { t } = useI18n();
  const [registerUser, state] = useRegisterMutation();
  useRedirectWhenAuthed();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(RegisterSchema) });
  return (
    <div className="card mx-auto w-full max-w-md p-6">
      <h1 className="mb-4 font-display text-2xl font-bold">{t.auth.createAccount}</h1>
      <form onSubmit={handleSubmit((v) => void registerUser({ ...v, phone: v.phone || undefined }))} className="space-y-3" noValidate>
        <div>
          <label className="label" htmlFor="name">{t.auth.name}</label>
          <input id="name" className="input" autoComplete="name" {...register('name')} />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input id="email" type="email" className="input" autoComplete="email" {...register('email')} />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="phone">{t.auth.phone}</label>
          <input
            id="phone"
            className="input"
            inputMode="tel"
            placeholder="01XXXXXXXXX"
            autoComplete="tel"
            {...register('phone', { setValueAs: (v: string) => (v ? v : undefined) })}
          />
          {errors.phone && <p className="field-error">{errors.phone.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input id="password" type="password" className="input" autoComplete="new-password" {...register('password')} />
          {errors.password && <p className="field-error">{errors.password.message}</p>}
        </div>
        {state.error && <p className="rounded bg-red-50 p-2 text-sm text-danger">{errorMessage(state.error)}</p>}
        <Button type="submit" block size="lg" loading={state.isLoading}>
          {t.common.signUp}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-600">
        {t.auth.haveAccount}{' '}
        <Link href="/login" className="font-semibold text-primary-700">
          {t.common.signIn}
        </Link>
      </p>
    </div>
  );
}
