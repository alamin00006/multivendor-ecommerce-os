import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/forms/auth-forms';

export const metadata: Metadata = { title: 'Create account', robots: { index: false } };

export default function RegisterPage() {
  return (
    <div className="container-site py-8 md:py-14">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
