'use client';

import { useSellerDashboardQuery } from '@marketbd/api-client';
import { AlertTriangle, Clock, Package, Wallet } from 'lucide-react';
import Link from 'next/link';
import { fmtDate, PageHeader, StatCard, Table } from '@/components/manage/panel';
import { useI18n } from '@/i18n/client';
import { ErrorState, Skeleton } from '@/components/ui';
import { OrderStatusBadge } from '@/components/ui/status';

export default function SellerDashboardPage() {
  const { money } = useI18n();
  const { data, isLoading, isError, error, refetch } = useSellerDashboardQuery();
  if (isError) {
    const msg = (error as { data?: { message?: string } } | undefined)?.data?.message ?? 'Could not load dashboard';
    return <ErrorState message={msg} onRetry={() => void refetch()} />;
  }
  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales" value={money(data.salesTotal)} icon={Wallet} />
        <StatCard label="Orders" value={String(data.ordersCount)} icon={Package} tone="info" />
        <StatCard label="To fulfil" value={String(data.pendingOrders)} icon={Clock} tone="accent" />
        <StatCard label="Products" value={String(data.productsCount)} icon={Package} tone="warning" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <section className="card">
          <h3 className="border-b border-ink-100 px-4 py-3 font-semibold">Recent orders</h3>
          <Table head={['Order', 'Items', 'Total', 'Status', 'Date']}>
            {data.recentOrders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3"><Link href={`/seller/orders/${o.id}`} className="font-medium text-primary-700">{o.orderNumber}</Link></td>
                <td className="px-4 py-3">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                <td className="px-4 py-3">{money(o.total)}</td>
                <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(o.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </section>
        <section className="card">
          <h3 className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 font-semibold">
            <AlertTriangle className="size-4 text-warning" /> Low stock
          </h3>
          {data.lowStock.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">All variants are well stocked.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.lowStock.map((v) => (
                <li key={v.variantId} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <Link href={`/seller/products/${v.productId}`} className="min-w-0">
                    <p className="truncate">{v.title}</p>
                    <p className="text-xs text-ink-500">{v.sku}</p>
                  </Link>
                  <span className={`font-bold ${v.stock === 0 ? 'text-danger' : 'text-warning'}`}>{v.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
