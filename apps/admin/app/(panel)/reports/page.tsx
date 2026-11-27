'use client';

import { useAdminReportQuery } from '@marketbd/api-client';
import { type AdminReport, fromPoisha } from '@marketbd/shared';
import { BarChart3, Download, ImageOff, Package, Percent, ShoppingBag, Truck, TrendingUp, Users } from 'lucide-react';
import {
  cn,
  downloadCsv,
  EmptyState,
  ErrorState,
  ORDER_STATUS_LABEL,
  PageHeader,
  ReportRangeBar,
  SalesChart,
  Skeleton,
  StatCard,
  useI18n,
  useReportRange,
} from '@marketbd/ui';

const PAYMENT_LABEL: Record<string, string> = { COD: 'Cash on delivery', BKASH: 'bKash', SSLCOMMERZ: 'Card / online', CASH: 'Cash (POS)' };

function exportCsv(r: AdminReport) {
  downloadCsv(`marketplace-report-${r.from}-to-${r.to}.csv`, [
    ['Date', 'Orders', 'Sales (BDT)', 'Commission (BDT)'],
    ...r.daily.map((d) => [d.date, d.orders, fromPoisha(d.gross), fromPoisha(d.net)]),
    [],
    ['Shop', 'Orders', 'Sales (BDT)', 'Commission (BDT)'],
    ...r.bySeller.map((s) => [s.shopName, s.orders, fromPoisha(s.gross), fromPoisha(s.commission)]),
    [],
    ['Category', 'Units sold', 'Sales (BDT)'],
    ...r.byCategory.map((c) => [c.name, c.units, fromPoisha(c.gross)]),
    [],
    ['Payment method', 'Orders', 'Sales (BDT)'],
    ...r.byPayment.map((p) => [PAYMENT_LABEL[p.method] ?? p.method, p.orders, fromPoisha(p.gross)]),
    [],
    ['Top products', 'Units sold', 'Sales (BDT)'],
    ...r.topProducts.map((p) => [p.title, p.units, fromPoisha(p.gross)]),
    [],
    ['Packages', r.totals.orders],
    ['Units sold', r.totals.units],
    ['Sales (BDT)', fromPoisha(r.totals.gross)],
    ['Commission (BDT)', fromPoisha(r.totals.commission)],
    ['Paid to shops (BDT)', fromPoisha(r.totals.net)],
    ['Delivery fees (BDT)', fromPoisha(r.totals.shipping)],
    ['Discounts (BDT)', fromPoisha(r.totals.discount)],
    ['Customers', r.totals.customers],
    ['New customers', r.totals.newCustomers],
    ['Cancelled', r.totals.cancelled],
    ['Returned', r.totals.returned],
  ]);
}

/** Horizontal bars for a share-of-total list. */
function ShareList({ rows }: { rows: Array<{ key: string; label: string; value: number; note: string }> }) {
  const { money } = useI18n();
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-ink-500">No sales in this period.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="truncate text-ink-700">{r.label}</span>
            <span className="shrink-0">
              <span className="font-semibold">{money(r.value)}</span> <span className="text-xs text-ink-500">· {r.note}</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-primary-600" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Admin → Reports: marketplace sales over a date range. */
export default function AdminReportsPage() {
  const { money } = useI18n();
  const period = useReportRange();
  const { data: r, isLoading, isFetching, isError, refetch } = useAdminReportQuery(period.range);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Packages ordered in the selected period, all shops together. Cancelled and returned ones are not counted as sales."
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
            <StatCard label="Sales" value={money(r.totals.gross)} hint={`Avg. package ${money(r.totals.avgOrder)}`} icon={TrendingUp} />
            <StatCard label="Commission earned" value={money(r.totals.commission)} hint={`Shops' share ${money(r.totals.net)}`} icon={Percent} tone="accent" />
            <StatCard label="Packages" value={String(r.totals.orders)} hint={`${r.totals.cancelled} cancelled · ${r.totals.returned} returned`} icon={ShoppingBag} tone="info" />
            <StatCard label="Customers" value={String(r.totals.customers)} hint={`${r.totals.newCustomers} joined in this period`} icon={Users} tone="warning" />
            <StatCard label="Units sold" value={String(r.totals.units)} icon={Package} />
            <StatCard label="Delivery fees" value={money(r.totals.shipping)} icon={Truck} tone="info" />
            <StatCard label="Discounts given" value={money(r.totals.discount)} icon={Percent} tone="warning" />
          </div>

          <section className="card p-4">
            <h3 className="mb-4 font-semibold">Daily sales</h3>
            {r.totals.orders === 0 ? <EmptyState icon={<BarChart3 />} title="No sales in this period" /> : <SalesChart daily={r.daily} netLabel="Commission" />}
          </section>

          <section className="card overflow-x-auto">
            <h3 className="border-b border-ink-100 px-4 py-3 font-semibold">Sales by shop</h3>
            {r.bySeller.length === 0 ? (
              <p className="p-4 text-sm text-ink-500">No sales in this period.</p>
            ) : (
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Shop</th>
                    <th className="px-4 py-2 text-right font-semibold">Packages</th>
                    <th className="px-4 py-2 text-right font-semibold">Sales</th>
                    <th className="px-4 py-2 text-right font-semibold">Commission</th>
                    <th className="px-4 py-2 text-right font-semibold">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {r.bySeller.map((s) => (
                    <tr key={s.sellerId}>
                      <td className="px-4 py-2.5 font-medium">{s.shopName}</td>
                      <td className="px-4 py-2.5 text-right">{s.orders}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{money(s.gross)}</td>
                      <td className="px-4 py-2.5 text-right">{money(s.commission)}</td>
                      <td className="px-4 py-2.5 text-right text-ink-500">{r.totals.gross ? Math.round((s.gross / r.totals.gross) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4">
              <h3 className="mb-3 font-semibold">Sales by category</h3>
              <ShareList rows={r.byCategory.map((c) => ({ key: c.categoryId, label: c.name, value: c.gross, note: `${c.units} sold` }))} />
            </section>
            <section className="card space-y-4 p-4">
              <div>
                <h3 className="mb-3 font-semibold">Payment methods</h3>
                <ShareList rows={r.byPayment.map((p) => ({ key: p.method, label: PAYMENT_LABEL[p.method] ?? p.method, value: p.gross, note: `${p.orders} orders` }))} />
              </div>
              {r.byChannel.length > 0 && (
                <div className="border-t border-ink-100 pt-3">
                  <h3 className="mb-3 font-semibold">Where it sold</h3>
                  <ShareList rows={r.byChannel.map((c) => ({ key: c.channel, label: c.channel === 'POS' ? 'Shop counter (POS)' : 'Online', value: c.gross, note: `${c.orders} packages` }))} />
                </div>
              )}
            </section>
          </div>

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
            <section className="card p-4">
              <h3 className="mb-2 font-semibold">Packages by status</h3>
              <ul className="space-y-1.5 text-sm">
                {r.byStatus.map((s) => (
                  <li key={s.status} className="flex justify-between">
                    <span className="text-ink-600">{ORDER_STATUS_LABEL[s.status] ?? s.status}</span>
                    <span className="font-semibold">{s.count}</span>
                  </li>
                ))}
                {r.byStatus.length === 0 && <li className="text-ink-500">No orders</li>}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
