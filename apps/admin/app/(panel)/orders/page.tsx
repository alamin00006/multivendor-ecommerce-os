'use client';

import { useAdminOrdersQuery } from '@marketbd/api-client';
import { ORDER_STATUSES, type OrderStatus, PAYMENT_STATUSES, type PaymentStatus } from '@marketbd/shared';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { fmtDate, PageHeader, Pager, Table, useI18n, EmptyState, Skeleton, OrderStatusBadge, PaymentStatusBadge } from '@marketbd/ui';

export default function AdminOrdersPage() {
  const { money } = useI18n();
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminOrdersQuery({ status: status || undefined, paymentStatus: paymentStatus || undefined, q: q || undefined, page, limit: 20 });
  return (
    <div>
      <PageHeader title="Orders" description={data ? `${data.meta.total} orders` : undefined} />
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3">
          <input className="input max-w-xs" placeholder="Order no, customer or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value as OrderStatus | ''); setPage(1); }}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className="input w-auto" value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value as PaymentStatus | ''); setPage(1); }}>
            <option value="">All payments</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Order', 'Customer', 'Items', 'Total', 'Method', 'Payment', 'Status', 'Date']} empty={!data?.items.length ? <EmptyState icon={<ShoppingBag />} title="No orders" /> : null}>
            {data?.items.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3"><Link href={`/orders/${o.id}`} className="font-medium text-primary-700">{o.orderNumber}</Link></td>
                <td className="px-4 py-3 text-xs">{o.customer?.name}<br />{o.customer?.phone}</td>
                <td className="px-4 py-3">{o.itemCount}</td>
                <td className="px-4 py-3">{money(o.total)}</td>
                <td className="px-4 py-3 text-xs">{o.paymentMethod}</td>
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
