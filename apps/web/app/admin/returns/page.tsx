'use client';

import { errorMessage, useAdminReturnsQuery, useAdminUpdateReturnMutation } from '@marketbd/api-client';
import { RETURN_STATUSES, type ReturnStatus } from '@marketbd/shared';
import { RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { fmtDate, PageHeader, Pager, Table } from '@/components/manage/panel';
import { Badge, EmptyState, Skeleton } from '@/components/ui';

const NEXT: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['RECEIVED', 'REJECTED'],
  RECEIVED: ['REFUNDED'],
  REJECTED: [],
  REFUNDED: [],
};

export default function AdminReturnsPage() {
  const [status, setStatus] = useState<ReturnStatus | ''>('REQUESTED');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminReturnsQuery({ status: status || undefined, page, limit: 20 });
  const [update] = useAdminUpdateReturnMutation();

  return (
    <div>
      <PageHeader title="Returns" description="Approve → mark received (restocks the items) → refund from the order page." />
      <div className="card">
        <div className="border-b border-ink-100 p-3">
          <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value as ReturnStatus | ''); setPage(1); }}>
            <option value="">All</option>
            {RETURN_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Order', 'Reason', 'Status', 'Requested', 'Action']} empty={!data?.items.length ? <EmptyState icon={<RotateCcw />} title="No return requests" /> : null}>
            {data?.items.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3"><Link href={`/admin/orders/${r.orderId}`} className="font-medium text-primary-700">{r.orderNumber}</Link></td>
                <td className="max-w-xs px-4 py-3 text-xs">{r.reason}</td>
                <td className="px-4 py-3"><Badge>{r.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(r.createdAt)}</td>
                <td className="px-4 py-3">
                  {NEXT[r.status].length > 0 && (
                    <select
                      className="input h-8 w-auto text-xs"
                      value=""
                      onChange={async (e) => {
                        const next = e.target.value as ReturnStatus;
                        if (!next) return;
                        try {
                          await update({ id: r.id, status: next }).unwrap();
                          toast.success(`Return ${next.toLowerCase()}`);
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    >
                      <option value="">Move to…</option>
                      {NEXT[r.status].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
      </div>
    </div>
  );
}
