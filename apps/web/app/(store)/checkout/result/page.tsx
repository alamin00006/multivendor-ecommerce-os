'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useI18n, ButtonLink } from '@marketbd/ui';

function Result() {
  const { t } = useI18n();
  const params = useSearchParams();
  const ok = params.get('status') === 'success';
  const order = params.get('order');
  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center gap-4 p-8 text-center">
      {ok ? <CheckCircle2 className="size-16 text-success" /> : <XCircle className="size-16 text-danger" />}
      <h1 className="font-display text-xl font-bold">{ok ? t.checkout.successTitle : t.checkout.failedTitle}</h1>
      {!ok && <p className="text-sm text-ink-600">{t.checkout.failedText}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        {order && <ButtonLink href={`/account/orders/${order}`}>{t.checkout.viewOrder}</ButtonLink>}
        <ButtonLink href="/" variant="outline">
          {t.checkout.continueShopping}
        </ButtonLink>
      </div>
    </div>
  );
}

export default function CheckoutResultPage() {
  return (
    <div className="container-site pt-10">
      <Suspense>
        <Result />
      </Suspense>
    </div>
  );
}
