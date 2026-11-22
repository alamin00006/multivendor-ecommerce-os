'use client';

import { useMarketplaceMode, useOrdersQuery } from '@marketbd/api-client';
import { BRAND, type OrderListQuery } from '@marketbd/shared';
import { ShoppingBasket } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useI18n, Button, cn, ErrorState, Skeleton, OrderStatusBadge, PaymentStatusBadge } from '@marketbd/ui';

interface Tab {
  key: string;
  label: string;
  query: Pick<OrderListQuery, 'status' | 'toPay'>;
}

// Tabs follow the order lifecycle; each maps to a real status (there is no separate "out for delivery" step).
const TABS: Tab[] = [
  { key: 'all', label: 'All', query: {} },
  { key: 'to-pay', label: 'To Pay', query: { toPay: true } },
  { key: 'pending', label: 'Pending', query: { status: 'PENDING' } },
  { key: 'confirmed', label: 'Confirmed', query: { status: 'CONFIRMED' } },
  { key: 'to-ship', label: 'To Ship', query: { status: 'PROCESSING' } },
  { key: 'shipped', label: 'Shipped', query: { status: 'SHIPPED' } },
  { key: 'delivered', label: 'Delivered', query: { status: 'DELIVERED' } },
];

const EMPTY: Record<string, string> = {
  all: 'You Haven’t Placed Any Orders Yet!',
  'to-pay': 'No orders waiting for payment',
  pending: 'No pending orders',
  confirmed: 'No confirmed orders',
  'to-ship': 'Nothing being packed right now',
  shipped: 'No orders on the way',
  delivered: 'No delivered orders yet',
};

/** Link to a tab of the order list, e.g. orderTabHref('to-pay'). */
export const orderTabHref = (key: string) => (key === 'all' ? '/account/orders' : `/account/orders?tab=${key}`);

/** Customer order list in a titled panel, with lifecycle tabs (?tab=to-pay opens that tab). */
export function OrdersList({ title }: { title: string }) {
  const { t, money, locale } = useI18n();
  const { showSellerInfo } = useMarketplaceMode();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => TABS.find((x) => x.key === params.get('tab')) ?? TABS[0]!);
  const [page, setPage] = useState(1);
  const query = tab.query;
  const { data, isLoading, isFetching, isError, refetch } = useOrdersQuery({ ...query, page, limit: 10 });

  return (
    <div className="min-h-[560px] rounded-lg bg-white p-5 shadow-card md:p-6">
      <h1 className="border-b border-ink-100 pb-4 text-2xl font-semibold text-ink-900">{title}</h1>

      <div className="scrollbar-none flex overflow-x-auto border-b border-ink-100" role="tablist">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={tab.key === tb.key}
            onClick={() => {
              setTab(tb);
              setPage(1);
            }}
            className={cn(
              '-mb-px min-w-24 shrink-0 border-b-2 px-4 py-3.5 text-sm transition',
              tab.key === tb.key
                ? 'border-accent-500 font-medium text-accent-600'
                : 'border-transparent text-ink-500 hover:text-ink-900',
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {isError ? (
        <ErrorState message={t.common.error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="space-y-3 pt-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-16 text-center">
          <ShoppingBasket className="size-28 text-ink-300" strokeWidth={1.25} />
          <p className="mt-5 text-xl font-semibold text-ink-900">{EMPTY[tab.key]}</p>
          <p className="mt-1.5 text-sm text-ink-600">Start shopping and discover great products picked just for you.</p>
          <Link
            href="/"
            className="mt-4 w-full max-w-sm rounded-full bg-gradient-to-r from-primary-700 to-accent-500 py-2.5 text-center font-semibold text-white transition hover:opacity-95"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className={cn('space-y-3 pt-4', isFetching && 'opacity-60')}>
          {data.items.map((o) => (
            <Link
              key={o.id}
              href={`/account/orders/${o.id}`}
              className="block rounded-lg border border-ink-100 transition hover:border-primary-200 hover:shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold text-ink-900">{o.orderNumber}</span>
                  <span className="ml-2 text-ink-500">
                    {new Date(o.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', {
                      dateStyle: 'medium',
                    })}
                  </span>
                  <span className="ml-2 text-ink-500">· {showSellerInfo ? o.shopNames.join(', ') : BRAND.name}</span>
                </span>
                <span className="flex gap-2">
                  <PaymentStatusBadge status={o.paymentStatus} />
                  <OrderStatusBadge status={o.status} />
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-3">
                {o.previewImages.slice(0, 4).map((src) => (
                  <Image key={src} src={src} alt="" width={56} height={56} className="size-14 rounded object-cover" />
                ))}
                <span className="ml-auto text-right text-sm">
                  <span className="text-ink-500">
                    {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}
                  </span>
                  <br />
                  <b className="text-base text-accent-600">{money(o.total)}</b>
                </span>
              </div>
              {tab.key === 'to-pay' && (
                <div className="border-t border-ink-100 px-4 py-2 text-right text-sm font-semibold text-accent-600">
                  Pay now →
                </div>
              )}
            </Link>
          ))}
          {data.meta.totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ‹
              </Button>
              <span className="self-center text-sm">
                {page} / {data.meta.totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                ›
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
