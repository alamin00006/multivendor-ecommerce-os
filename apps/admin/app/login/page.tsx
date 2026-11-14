'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { errorMessage, selectAuth, useLoginMutation, useLogoutMutation } from '@marketbd/api-client';
import { BRAND, type LoginInput, LoginSchema } from '@marketbd/shared';
import { Button, Logo } from '@marketbd/ui';
import { ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';

const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, status } = useSelector(selectAuth);
  const [login, state] = useLoginMutation();
  const [logout] = useLogoutMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  const isAdmin = status === 'authenticated' && user?.role === 'ADMIN';
  const wrongRole = status === 'authenticated' && user && user.role !== 'ADMIN';

  useEffect(() => {
    if (isAdmin) router.replace(safeNext(params.get('next')));
  }, [isAdmin, router, params]);

  return (
    <div className="card w-full max-w-sm space-y-5 p-6">
      <div className="space-y-2 text-center">
        <Logo className="justify-center" />
        <p className="flex items-center justify-center gap-1.5 text-sm text-ink-500">
          <ShieldCheck className="size-4 text-primary-700" /> {BRAND.name} Admin
        </p>
      </div>
      {wrongRole ? (
        <div className="space-y-3 text-center text-sm">
          <p className="rounded-md bg-red-50 p-3 text-danger">This account does not have admin access.</p>
          <Button variant="outline" block onClick={() => void logout()}>
            Sign in with another account
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit((v) => void login(v))} className="space-y-3" noValidate>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="username" {...register('email')} />
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="field-error">{errors.password.message}</p>}
          </div>
          {state.error && <p className="rounded bg-red-50 p-2 text-sm text-danger">{errorMessage(state.error)}</p>}
          <Button type="submit" block size="lg" loading={state.isLoading || isAdmin}>
            Sign in
          </Button>
        </form>
      )}
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
