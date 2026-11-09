import Link from 'next/link';
import { getDictionary } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getDictionary();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-7xl font-bold text-primary-700">404</p>
      <h1 className="text-xl font-semibold">{t.common.notFound}</h1>
      <Link href="/" className="rounded-md bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white">
        {t.common.backHome}
      </Link>
    </div>
  );
}
