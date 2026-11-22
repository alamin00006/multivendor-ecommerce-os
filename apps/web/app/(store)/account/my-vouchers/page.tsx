'use client';

import { selectUser, useAvailableCouponsQuery, useMyVouchersQuery } from '@marketbd/api-client';
import type { CouponView } from '@marketbd/shared';
import { Ticket } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { cn, EmptyState, Skeleton, VoucherCard } from '@marketbd/ui';
import { useCollectVoucher } from '@/components/account/use-collect';

/** A running voucher counts as "expiring" in its last week. */
const EXPIRING_WITHIN_MS = 7 * 86_400_000;

type Tab = 'recent' | 'expiring' | 'store';

const EMPTY: Record<Tab, { title: string; text: string }> = {
  recent: { title: 'No collected vouchers yet', text: 'Collect vouchers in the Voucher Center and they will wait here for checkout.' },
  expiring: { title: 'Nothing expiring soon', text: 'Vouchers in their last 7 days show up here so you can use them in time.' },
  store: { title: 'No store vouchers collected', text: 'Shop vouchers you collect from stores and product pages show up here.' },
};

/** The customer's voucher wallet: recently collected, about to expire, and shop vouchers. */
export default function MyVouchersPage() {
  const user = useSelector(selectUser);
  const { data: mine = [], isLoading: loadingMine } = useMyVouchersQuery();
  const { data: running = [], isLoading: loadingRunning } = useAvailableCouponsQuery(user?.id);
  const { onCollect, busyId } = useCollectVoucher();
  const [tab, setTab] = useState<Tab>('recent');
  // Taken once per visit: enough precision for a "expires within a few days" filter.
  const [now] = useState(() => Date.now());

  const usable = mine.filter((v) => v.status === 'AVAILABLE'); // already newest-collected first
  const lists: Record<Tab, CouponView[]> = {
    recent: usable,
    expiring: running
      .filter((v) => new Date(v.endsAt).getTime() - now <= EXPIRING_WITHIN_MS)
      .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime()),
    store: usable.filter((v) => v.scope === 'STORE'),
  };
  const tabs: { key: Tab; label: string }[] = [
    { key: 'recent', label: 'Recently Collected' },
    { key: 'expiring', label: 'Expiring' },
    { key: 'store', label: 'Store' },
  ];
  const shown = lists[tab];
  const loading = loadingMine || (tab === 'expiring' && loadingRunning);

  return (
    <div>
      <h1 className="mb-4 px-1 text-2xl font-semibold text-ink-900">My Voucher</h1>
      <div className="min-h-[320px] rounded-lg bg-white px-5 pb-6 shadow-card md:px-6">
        <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto border-b border-ink-100" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-2 py-3.5 text-[15px] transition',
                tab === t.key ? 'border-accent-500 font-semibold text-accent-600' : 'border-transparent font-medium text-ink-800 hover:text-accent-600',
              )}
            >
              {t.label}
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tab === t.key ? 'bg-accent-500 text-white' : 'bg-ink-100 text-ink-600')}>
                {lists[t.key].length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <Skeleton className="h-40" />
        ) : !shown.length ? (
          <EmptyState
            icon={<Ticket />}
            title={EMPTY[tab].title}
            text={EMPTY[tab].text}
            action={
              <Link href="/account/vouchers" className="rounded-md bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600">
                Go to Voucher Center
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {shown.map((v) => (
              <VoucherCard key={v.id} voucher={v} onCollect={() => void onCollect(v.id)} collecting={busyId === v.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
