'use client';

import { selectUser, useAvailableCouponsQuery } from '@marketbd/api-client';
import type { CouponScope, CouponView } from '@marketbd/shared';
import { Ticket } from 'lucide-react';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { cn, EmptyState, Skeleton, VoucherCard } from '@marketbd/ui';
import { useCollectVoucher } from '@/components/account/use-collect';

const SECTIONS: { scope: CouponScope; tab: string; title: string }[] = [
  { scope: 'PLATFORM', tab: 'MarketBD', title: 'MarketBD Vouchers' },
  { scope: 'STORE', tab: 'Store', title: 'Store Vouchers' },
  { scope: 'PAYMENT', tab: 'Payment', title: 'Payment Vouchers' },
];

function Section({ title, vouchers }: { title: string; vouchers: CouponView[] }) {
  const { onCollect, busyId } = useCollectVoucher();
  if (!vouchers.length) return null;
  return (
    <section>
      <h2 className="mb-4 border-b border-ink-100 pb-2 text-lg font-semibold text-ink-900">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {vouchers.map((v) => (
          <VoucherCard key={v.id} voucher={v} onCollect={() => void onCollect(v.id)} collecting={busyId === v.id} />
        ))}
      </div>
    </section>
  );
}

/** Every running voucher, grouped like the reference: platform, store and payment vouchers. */
export default function VoucherCenterPage() {
  const user = useSelector(selectUser);
  const { data: vouchers = [], isLoading } = useAvailableCouponsQuery(user?.id);
  const [tab, setTab] = useState<CouponScope | 'ALL'>('ALL');
  const count = (scope: CouponScope) => vouchers.filter((v) => v.scope === scope).length;
  const tabs = [{ key: 'ALL' as const, label: 'All Vouchers', n: vouchers.length }, ...SECTIONS.map((s) => ({ key: s.scope, label: s.tab, n: count(s.scope) }))];

  return (
    <div>
      <h1 className="mb-4 px-1 text-2xl font-semibold text-ink-900">Voucher Center</h1>
      <div className="mb-4 rounded-lg bg-white px-3 shadow-card">
        <div className="scrollbar-none flex gap-2 overflow-x-auto" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3.5 text-[15px] transition',
                tab === t.key ? 'border-accent-500 font-semibold text-accent-600' : 'border-transparent text-ink-800 hover:text-accent-600',
              )}
            >
              {t.label}
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tab === t.key ? 'bg-accent-500 text-white' : 'bg-ink-100 text-ink-600')}>{t.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8 rounded-lg bg-white p-5 shadow-card md:p-6">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !vouchers.length ? (
          <EmptyState icon={<Ticket />} title="No vouchers right now" text="New vouchers appear here during campaigns." />
        ) : (
          SECTIONS.filter((s) => tab === 'ALL' || tab === s.scope).map((s) => (
            <Section key={s.scope} title={s.title} vouchers={vouchers.filter((v) => v.scope === s.scope)} />
          ))
        )}
      </div>
    </div>
  );
}
