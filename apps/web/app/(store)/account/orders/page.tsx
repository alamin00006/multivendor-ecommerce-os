'use client';

import { useOrdersQuery } from '@marketbd/api-client';
import type { OrderStatus } from '@marketbd/shared';
import { Package } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useI18n, Button, ButtonLink, cn, EmptyState, ErrorState, Skeleton, OrderStatusBadge, PaymentStatusBadge } from '@marketbd/ui';

const TABS: Array<OrderStatus | undefined> = [undefined, 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED'];

export default function OrdersPage() {
  const { t, money, locale } = useI18n();
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useOrdersQuery({ status, page, limit: 10 });

  return (
    <div className="space-y-3">
      <div className="card scrollbar-none flex gap-1 overflow-x-auto p-1.5">
        {TABS.map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={cn('shrink-0 rounded-md px-3 py-1.5 text-sm', status === s ? 'bg-primary-700 text-white' : 'text-ink-600 hover:bg-ink-50')}
          >
            {s ? t.status[s] : t.common.seeAll}
          </button>
        ))}
      </div>
      {isError ? (
        <ErrorState message={t.common.error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Package />} title={t.account.noOrders} action={<ButtonLink href="/">{t.checkout.continueShopping}</ButtonLink>} />
        </div>
      ) : (
        <>
          {data.items.map((o) => (
            <Link key={o.id} href={`/account/orders/${o.id}`} className="card block p-4 transition hover:shadow-raised">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {t.account.orderNumber} <b>{o.orderNumber}</b>
                  <span className="ml-2 text-ink-500">
                    {new Date(o.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium' })}
                  </span>
                </span>
                <span className="flex gap-2">
                  <PaymentStatusBadge status={o.paymentStatus} />
                  <OrderStatusBadge status={o.status} />
                </span>
              </div>
              <div className="flex items-center gap-2">
                {o.previewImages.slice(0, 4).map((src) => (
                  <Image key={src} src={src} alt="" width={56} height={56} className="size-14 rounded object-cover" />
                ))}
                <span className="ml-auto text-right text-sm">
                  {o.itemCount} {t.cart.items}
                  <br />
                  <b className="text-accent-600">{money(o.total)}</b>
                </span>
              </div>
            </Link>
          ))}
          {data.meta.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
              <span className="self-center text-sm">{page} / {data.meta.totalPages}</span>
              <Button size="sm" variant="ghost" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>›</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
