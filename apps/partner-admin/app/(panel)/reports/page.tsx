'use client';

import { useSellerReportQuery } from '@marketbd/api-client';
import { fromPoisha, type SellerReport } from '@marketbd/shared';
import { BarChart3, Download, ImageOff, Package, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { cn, downloadCsv, EmptyState, ErrorState, ORDER_STATUS_LABEL, PageHeader, ReportRangeBar, SalesChart, Skeleton, StatCard, useI18n, useReportRange } from '@marketbd/ui';

function exportCsv(r: SellerReport) {
  downloadCsv(`sales-report-${r.from}-to-${r.to}.csv`, [
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
  ]);
}

/** Seller Center → Reports: sales over a date range. */
export default function SellerReportsPage() {
  const { money } = useI18n();
  const period = useReportRange();
  const { data: r, isLoading, isFetching, isError, refetch } = useSellerReportQuery(period.range);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales reports"
        description="Orders placed in the selected period. Cancelled and returned orders are not counted as sales."
        actions={
          r && (
            <button type="button" onClick={() => exportCsv(r)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 text-sm font-medium hover:bg-ink-50">
              <Download className="size-4" /> Download CSV
            </button>
          )
        }
      />

      <ReportRangeBar {...period} />

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
                      <span className="text-ink-600">{ORDER_STATUS_LABEL[s.status] ?? s.status}</span>
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
