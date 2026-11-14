'use client';

import { useProductReviewsQuery, useReviewSummaryQuery } from '@marketbd/api-client';
import { BadgeCheck, ChevronDown, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useI18n, cn, EmptyState, Skeleton, Stars } from '@marketbd/ui';

export function ProductReviews({ productId }: { productId: string }) {
  const { t, locale } = useI18n();
  const [rating, setRating] = useState<number | undefined>();
  // Starts with a short list and grows with "See more", like the reference layout.
  const [limit, setLimit] = useState(3);
  const { data: summary } = useReviewSummaryQuery(productId);
  const { data, isFetching } = useProductReviewsQuery({ productId, page: 1, limit, rating });

  return (
    <section id="reviews" className="card scroll-mt-48 p-4">
      <h2 className="mb-4 font-semibold">{t.product.ratingsReviews}</h2>
      {summary && summary.count > 0 ? (
        <div className="mb-5 grid gap-6 border-b border-ink-100 pb-5 sm:grid-cols-[180px_1fr]">
          <div className="text-center sm:text-left">
            <p className="text-4xl font-bold">
              {summary.average.toFixed(1)}
              <span className="text-base font-normal text-ink-400">/5</span>
            </p>
            <Stars value={summary.average} size={18} />
            <p className="mt-1 text-sm text-ink-500">
              {summary.count} {t.common.reviews}
            </p>
          </div>
          <div className="space-y-1.5">
            {(['5', '4', '3', '2', '1'] as const).map((r) => {
              const n = summary.distribution[r];
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setLimit(3);
                    setRating(rating === Number(r) ? undefined : Number(r));
                  }}
                  className={cn('flex w-full items-center gap-2 text-sm', rating === Number(r) && 'font-semibold text-primary-700')}
                >
                  <span className="w-6">{r}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span className="block h-full rounded-full bg-warning" style={{ width: `${(n / summary.count) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right text-xs text-ink-500">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!data && isFetching ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : data && data.items.length > 0 ? (
        <ul className="divide-y divide-ink-100">
          {data.items.map((r) => (
            <li key={r.id} className="space-y-1.5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Stars value={r.rating} />
                <span className="font-medium">{r.user.name}</span>
                {r.isVerifiedPurchase && (
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <BadgeCheck className="size-3.5" /> {t.product.verified}
                  </span>
                )}
                <span className="ml-auto text-xs text-ink-400">
                  {new Date(r.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB')}
                </span>
              </div>
              {r.comment && <p className="text-sm text-ink-700">{r.comment}</p>}
              {r.images.length > 0 && (
                <div className="flex gap-2">
                  {r.images.map((src) => (
                    <Image key={src} src={src} alt="" width={64} height={64} className="size-16 rounded object-cover" />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<MessageSquare />} title={t.product.noReviews} />
      )}

      {data && data.meta.total > data.items.length && (
        <div className="mt-2 text-center">
          <button
            type="button"
            disabled={isFetching}
            onClick={() => setLimit((l) => Math.min(l + 5, 100))}
            className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-4 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-200 disabled:opacity-50"
          >
            {isFetching ? t.common.loading : 'See more'} <ChevronDown className="size-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}
