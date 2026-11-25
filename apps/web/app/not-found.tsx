import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@marketbd/ui';
import { getDictionary } from '@/i18n/server';

/** 404: a small centred card with the logo, an illustration and a way home (reference layout). */
export default async function NotFound() {
  const { t } = await getDictionary();
  return (
    <div className="flex min-h-[70vh] items-start justify-center bg-canvas px-4 pt-6">
      <div className="card flex w-full max-w-md flex-col items-center gap-4 px-6 py-12 text-center">
        <Logo />
        <div className="relative mt-2">
          <FileQuestion className="size-16 text-accent-500" strokeWidth={1.4} aria-hidden />
          <span className="absolute -right-4 -top-2 rounded bg-accent-500 px-1.5 py-0.5 text-xs font-bold text-white">404</span>
        </div>
        <h1 className="text-sm text-ink-700">{t.common.notFound}</h1>
        <Link href="/" className="rounded-md bg-primary-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-primary-800">
          {t.common.backHome}
        </Link>
      </div>
    </div>
  );
}
