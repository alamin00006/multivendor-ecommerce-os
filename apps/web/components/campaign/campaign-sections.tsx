'use client';

import { selectUser, useAvailableCouponsQuery, useProductFeedQuery } from '@marketbd/api-client';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useI18n, VoucherCard } from '@marketbd/ui';
import { useCollectVoucher } from '@/components/account/use-collect';
import { ProductGrid } from '@/components/product/product-card';

/** "Collect Voucher & Enjoy Discount": the running vouchers the admin attached to this campaign. */
export function CampaignVouchers({ codes }: { codes: string[] }) {
  const user = useSelector(selectUser);
  const { data: all = [] } = useAvailableCouponsQuery(user?.id, { skip: codes.length === 0 });
  const { onCollect, busyId } = useCollectVoucher();
  const wanted = new Set(codes.map((c) => c.toUpperCase()));
  const vouchers = all.filter((v) => wanted.has(v.code.toUpperCase()));
  if (!vouchers.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-ink-900">Collect Voucher &amp; Enjoy Discount</h2>
      <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
        {vouchers.map((v) => (
          <VoucherCard key={v.id} voucher={v} onCollect={() => void onCollect(v.id)} collecting={busyId === v.id} className="w-[85%] shrink-0 snap-start sm:w-auto" />
        ))}
      </div>
    </section>
  );
}

/** Campaign products: a plain 6-column grid with "Load more", like the reference campaign pages. */
export function CampaignProducts({ slug }: { slug: string }) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const { data, isFetching, isError, refetch } = useProductFeedQuery({ campaign: slug, page, limit: 30, sort: 'popular' });
  const hasMore = data ? data.meta.page < data.meta.totalPages : false;
  return (
    <section>
      <ProductGrid products={data?.items ?? []} loading={isFetching} skeletons={data ? 6 : 12} />
      <div className="py-6 text-center text-sm text-ink-500">
        {isError ? (
          <button type="button" onClick={() => void refetch()} className="font-semibold text-primary-700">
            {t.common.retry}
          </button>
        ) : hasMore ? (
          <button
            type="button"
            disabled={isFetching}
            onClick={() => data && setPage(data.meta.page + 1)}
            className="rounded-full border border-ink-300 bg-white px-8 py-2.5 text-sm font-semibold text-ink-800 hover:border-primary-700 hover:text-primary-700 disabled:opacity-50"
          >
            {isFetching ? t.common.loading : t.common.loadMore}
          </button>
        ) : data && data.items.length === 0 ? (
          'Products for this campaign are coming soon.'
        ) : data ? (
          t.common.nothingMore
        ) : null}
      </div>
    </section>
  );
}
