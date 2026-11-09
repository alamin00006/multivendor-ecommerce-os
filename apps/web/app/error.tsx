'use client';

import { useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import { Button, ButtonLink } from '@/components/ui';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">{t.common.error}</h1>
      <div className="flex gap-3">
        <Button onClick={reset}>{t.common.retry}</Button>
        <ButtonLink href="/" variant="outline">
          {t.common.backHome}
        </ButtonLink>
      </div>
    </div>
  );
}
