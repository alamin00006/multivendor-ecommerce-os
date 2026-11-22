'use client';

import { useSellerReportQuery } from '@marketbd/api-client';
import { fromPoisha, type SellerReport } from '@marketbd/shared';
import { BarChart3, Download, ImageOff, Package, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { cn, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, useI18n } from '@marketbd/ui';

/** Today's date in Dhaka as YYYY-MM-DD. */
const dhakaToday = () => new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const PRESETS = [
  { key: '7', label: 'Last 7 days', from: (t: string) => shift(t, -6) },
  { key: '30', label: 'Last 30 days', from: (t: string) => shift(t, -29) },
  { key: '90', label: 'Last 90 days', from: (t: string) => shift(t, -89) },
  { key: 'month', label: 'This month', from: (t: string) => `${t.slice(0, 8)}01` },
] as const;

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Packing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
};

/** Rounds the axis maximum up to a "nice" number so gridlines land on round taka values. */
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
};

function SalesChart({ daily }: { daily: SellerReport['daily'] }) {
  const { money } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...daily.map((d) => d.gross)));
  const ticks = [1, 0.5, 0];
  const labelEvery = Math.ceil(daily.length / 8);
  const h = hover === null ? null : daily[hover];

  return (
    <figure className="relative">
      <div className="flex gap-2">
        {/* y-axis */}
        <div className="flex h-56 w-16 shrink-0 flex-col justify-between text-right text-[11px] text-ink-400" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {money(max * t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className={cn('border-t', t === 0 ? 'border-ink-300' : 'border-dashed border-ink-100')} />
            ))}
          </div>
          <div className="relative flex h-56 items-end" style={{ gap: daily.length > 45 ? 1 : 2 }} onMouseLeave={() => setHover(null)}>
            {daily.map((d, i) => (
              <button
                key={d.date}
                type="button"
                className="group flex h-full min-w-0 flex-1 items-end focus:outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${shortDay(d.date)}: ${money(d.gross)} from ${d.orders} orders`}
              >
                <span
                  className={cn('block w-full rounded-t-[4px] bg-primary-600 transition-colors', hover === i ? 'bg-primary-800' : hover !== null && 'bg-primary-300')}
                  style={{ height: d.gross ? `max(2px, ${(d.gross / max) * 100}%)` : 0 }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex text-[11px] text-ink-400" aria-hidden>
            {daily.map((d, i) => (
              <span key={d.date} className="min-w-0 flex-1 text-center">
                {i % labelEvery === 0 ? shortDay(d.date) : ''}
              </span>
            ))}
          </div>
          {h && hover !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-0 z-10 w-40 rounded-lg bg-white p-2.5 text-xs shadow-raised ring-1 ring-ink-100"
              style={{ left: `clamp(0px, calc(${((hover + 0.5) / daily.length) * 100}% - 80px), calc(100% - 160px))` }}
            >
              <p className="font-semibold text-ink-900">{shortDay(h.date)}</p>
              <p className="mt-1 flex justify-between text-ink-600">
                Sales <span className="font-semibold text-ink-900">{money(h.gross)}</span>
              </p>
              <p className="flex justify-between text-ink-600">
                Orders <span className="font-semibold text-ink-900">{h.orders}</span>
              </p>
              <p className="flex justify-between text-ink-600">
                You earn <span className="font-semibold text-ink-900">{money(h.net)}</span>
              </p>
            </div>
          )}
        </div>
      </div>
      <figcaption className="sr-only">Daily sales. Download the CSV for the full numbers.</figcaption>
    </figure>
  );
}

const csvCell = (v: string | number) => (typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`);

function downloadCsv(r: SellerReport) {
  const lines = [
    ['Date', 'Orders', 'Sales (BDT)', 'Earnings after commission (BDT)'],
    ...r.daily.map((d) => [d.date, d.orders, fromPoisha(d.gross), fromPoisha(d.net)]),
    [],
    ['Top products', 'Units sold', 'Sales (BDT)'],
    ...r.topProducts.map((p) => [p.title, p.units, fromPoisha(p.gross)]),
    [],
    ['Total orders', r.totals.orders],
    ['Units sold', r.totals.units],
    ['Sales (BDT)', fromPoisha(r.totals.gross)],
    ['Commission (BDT)', fromPoisha(r.totals.commission)],
    ['Earnings (BDT)', fromPoisha(r.totals.net)],
    ['Cancelled', r.totals.cancelled],
    ['Returned', r.totals.returned],
  ];
  const csv = lines.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `sales-report-${r.from}-to-${r.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Seller Center → Reports: sales over a date range. */
export default function SellerReportsPage() {
  const { money } = useI18n();
  const [today] = useState(dhakaToday);
  const [range, setRange] = useState({ from: shift(today, -29), to: today });
  const [preset, setPreset] = useState<string>('30');
  const { data: r, isLoading, isFetching, isError, refetch } = useSellerReportQuery(range);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales reports"
        description="Orders placed in the selected period. Cancelled and returned orders are not counted as sales."
        actions={
          r && (
            <button type="button" onClick={() => downloadCsv(r)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 text-sm font-medium hover:bg-ink-50">
              <Download className="size-4" /> Download CSV
            </button>
          )
        }
      />

      <div className="card flex flex-wrap items-center gap-2 p-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={preset === p.key}
            onClick={() => {
              setPreset(p.key);
              setRange({ from: p.from(today), to: today });
            }}
            className={cn('rounded-full border px-3 py-1 text-sm', preset === p.key ? 'border-primary-700 bg-primary-50 font-semibold text-primary-800' : 'border-ink-200 text-ink-600')}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="date"
            aria-label="From"
            className="input h-9 w-auto"
            value={range.from}
            max={range.to}
            onChange={(e) => {
              if (!e.target.value) return;
              setPreset('');
              setRange((x) => ({ ...x, from: e.target.value }));
            }}
          />
          <span className="text-ink-400">to</span>
          <input
            type="date"
            aria-label="To"
            className="input h-9 w-auto"
            value={range.to}
            min={range.from}
            max={today}
            onChange={(e) => {
              if (!e.target.value) return;
              setPreset('');
              setRange((x) => ({ ...x, to: e.target.value }));
            }}
          />
        </div>
      </div>

      {isError ? (
        <ErrorState message="Could not load the report. Pick a range of one year or less." onRetry={() => void refetch()} />
      ) : isLoading || !r ? (
        <Skeleton className="h-96" />
      ) : (
        <div className={cn('space-y-4', isFetching && 'opacity-60')}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Sales" value={money(r.totals.gross)} hint={`Avg. order ${money(r.totals.avgOrder)}`} icon={TrendingUp} />
            <StatCard label="Your earnings" value={money(r.totals.net)} hint={`Commission ${money(r.totals.commission)}`} icon={Wallet} tone="accent" />
            <StatCard label="Orders" value={String(r.totals.orders)} hint={`${r.totals.cancelled} cancelled · ${r.totals.returned} returned`} icon={ShoppingBag} tone="info" />
            <StatCard label="Units sold" value={String(r.totals.units)} icon={Package} tone="warning" />
          </div>

          <section className="card p-4">
            <h3 className="mb-4 font-semibold">Daily sales</h3>
            {r.totals.orders === 0 ? <EmptyState icon={<BarChart3 />} title="No sales in this period" /> : <SalesChart daily={r.daily} />}
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="card">
              <h3 className="border-b border-ink-100 px-4 py-3 font-semibold">Best-selling products</h3>
              {r.topProducts.length === 0 ? (
                <p className="p-4 text-sm text-ink-500">Nothing sold yet in this period.</p>
              ) : (
                <ol className="divide-y divide-ink-100">
                  {r.topProducts.map((p, i) => (
                    <li key={p.productId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="w-5 text-center font-semibold text-ink-400">{i + 1}</span>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="size-10 rounded object-cover" />
                      ) : (
                        <span className="flex size-10 items-center justify-center rounded bg-ink-50 text-ink-300">
                          <ImageOff className="size-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      <span className="w-16 text-right text-ink-600">{p.units} sold</span>
                      <span className="w-24 text-right font-semibold">{money(p.gross)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section className="card space-y-4 p-4">
              <div>
                <h3 className="mb-2 font-semibold">Orders by status</h3>
                <ul className="space-y-1.5 text-sm">
                  {r.byStatus.map((s) => (
                    <li key={s.status} className="flex justify-between">
                      <span className="text-ink-600">{STATUS_LABEL[s.status] ?? s.status}</span>
                      <span className="font-semibold">{s.count}</span>
                    </li>
                  ))}
                  {r.byStatus.length === 0 && <li className="text-ink-500">No orders</li>}
                </ul>
              </div>
              {r.byChannel.length > 0 && (
                <div className="border-t border-ink-100 pt-3">
                  <h3 className="mb-2 font-semibold">Where you sold</h3>
                  <ul className="space-y-1.5 text-sm">
                    {r.byChannel.map((c) => (
                      <li key={c.channel} className="flex justify-between">
                        <span className="text-ink-600">{c.channel === 'POS' ? 'Shop counter (POS)' : 'Online'}</span>
                        <span>
                          <span className="font-semibold">{money(c.gross)}</span> <span className="text-xs text-ink-500">· {c.orders} orders</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
