'use client';

import { useSellerOrdersQuery } from '@marketbd/api-client';
import { ORDER_STATUSES, type OrderStatus } from '@marketbd/shared';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { fmtDate, PageHeader, Pager, Table } from '@/components/manage/panel';
import { useI18n } from '@/i18n/client';
import { EmptyState, Skeleton } from '@/components/ui';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/status';

export default function SellerOrdersPage() {
  const { money } = useI18n();
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSellerOrdersQuery({ status: status || undefined, q: q || undefined, page, limit: 20 });
  return (
    <div>
      <PageHeader title="Orders" description="Only your packages from each customer order are shown." />
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3">
          <input className="input max-w-xs" placeholder="Order number" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value as OrderStatus | ''); setPage(1); }}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Order', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Date']} empty={!data?.items.length ? <EmptyState icon={<ShoppingBag />} title="No orders yet" /> : null}>
            {data?.items.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3"><Link href={`/seller/orders/${o.id}`} className="font-medium text-primary-700">{o.orderNumber}</Link></td>
                <td className="px-4 py-3 text-xs">{o.shippingAddress.fullName}<br />{o.shippingAddress.district}</td>
                <td className="px-4 py-3">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                <td className="px-4 py-3">{money(o.total)}</td>
                <td className="px-4 py-3"><PaymentStatusBadge status={o.paymentStatus} /></td>
                <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(o.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
      </div>
    </div>
  );
}
