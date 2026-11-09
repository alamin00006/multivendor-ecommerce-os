'use client';

import type { FlashSaleView } from '@marketbd/shared';
import { Zap } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { Countdown, ProductGrid } from '@/components/product/product-card';
import { ButtonLink, EmptyState } from '@/components/ui';

export function FlashSalePage({ sale }: { sale: FlashSaleView | null }) {
  const { t, pick } = useI18n();
  if (!sale || sale.items.length === 0) {
    return (
      <div className="container-site pt-6">
        <div className="card">
          <EmptyState icon={<Zap />} title={t.home.flashSale} text={t.listing.noResults} action={<ButtonLink href="/">{t.common.backHome}</ButtonLink>} />
        </div>
      </div>
    );
  }
  return (
    <div className="container-site space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-flash to-accent-500 p-5 text-white">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Zap className="size-7 fill-white" /> {pick(sale.title, sale.titleBn)}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          {t.home.endsIn} <Countdown endsAt={sale.endAt} />
        </div>
      </div>
      <ProductGrid products={sale.items.map((i) => i.product)} />
    </div>
  );
}
