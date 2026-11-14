'use client';

import { useAdminDashboardQuery, useMarketplaceMode } from '@marketbd/api-client';
import type { OrderStatus } from '@marketbd/shared';
import { Clock, Package, Percent, ShoppingBag, Store, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { fmtDate, PageHeader, StatCard, Table, useI18n, ErrorState, Skeleton, OrderStatusBadge } from '@marketbd/ui';

function SalesChart({ days }: { days: Array<{ date: string; total: number; orders: number }> }) {
  const { money } = useI18n();
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <div className="flex h-48 items-end gap-1" role="img" aria-label="Sales in the last 30 days">
      {days.map((d) => (
        <div key={d.date} className="group relative flex-1">
          <div className="rounded-t bg-primary-500 transition group-hover:bg-primary-700" style={{ height: `${Math.max(2, (d.total / max) * 180)}px` }} />
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink-900 px-2 py-1 text-xs text-white group-hover:block">
            {d.date}: {money(d.total)} · {d.orders} orders
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { money } = useI18n();
  const { multiVendor } = useMarketplaceMode();
  const { data, isLoading, isError, refetch } = useAdminDashboardQuery();
  if (isError) return <ErrorState message="Could not load dashboard" onRetry={() => void refetch()} />;
  if (isLoading || !data) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description={multiVendor ? 'Multi-vendor marketplace' : 'Single-vendor store'} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={money(data.revenue)} icon={Wallet} />
        <StatCard label="Orders" value={data.ordersCount.toLocaleString()} icon={ShoppingBag} tone="info" />
        <StatCard label="Customers" value={data.customersCount.toLocaleString()} icon={Users} tone="accent" />
        <StatCard label="Active products" value={data.productsCount.toLocaleString()} icon={Package} tone="warning" />
        {multiVendor && (
          <>
            <StatCard label="Sellers" value={String(data.sellersCount)} icon={Store} />
            <StatCard label="Pending sellers" value={String(data.pendingSellers)} icon={Clock} tone="accent" />
            <StatCard label="Commission earned" value={money(data.commissionEarned)} icon={Percent} tone="info" />
          </>
        )}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="card p-4">
          <h3 className="mb-4 font-semibold">Sales — last 30 days</h3>
          <SalesChart days={data.salesLast30Days} />
        </section>
        <section className="card p-4">
          <h3 className="mb-3 font-semibold">Orders by status</h3>
          <ul className="space-y-2 text-sm">
            {(Object.entries(data.ordersByStatus) as Array<[OrderStatus, number]>).map(([s, n]) => (
              <li key={s} className="flex items-center justify-between">
                <OrderStatusBadge status={s} /> <b>{n}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="card">
        <h3 className="border-b border-ink-100 px-4 py-3 font-semibold">Recent orders</h3>
        <Table head={['Order', 'Customer', 'Total', 'Status', 'Date']}>
          {data.recentOrders.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3"><Link href={`/orders/${o.id}`} className="font-medium text-primary-700">{o.orderNumber}</Link></td>
              <td className="px-4 py-3">{o.customer?.name}</td>
              <td className="px-4 py-3">{money(o.total)}</td>
              <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
              <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(o.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
