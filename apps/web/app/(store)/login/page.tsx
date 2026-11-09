import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/forms/auth-forms';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="container-site py-8 md:py-14">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
