'use client';

import { errorMessage, useAdminDocumentQueueQuery, useAdminSellersQuery, useAdminUpdateSellerMutation } from '@marketbd/api-client';
import { SELLER_STATUSES, type SellerStatus } from '@marketbd/shared';
import { BadgeCheck, FileText, Store } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { fmtDate, PageHeader, Pager, Table, Badge, Button, EmptyState, Skeleton } from '@marketbd/ui';
import { SellerDocumentsReview } from '../../../components/seller-documents-review';

const TONE: Record<SellerStatus, 'success' | 'warning' | 'danger'> = { APPROVED: 'success', PENDING: 'warning', SUSPENDED: 'danger' };

export default function AdminSellersPage() {
  const [status, setStatus] = useState<SellerStatus | ''>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminSellersQuery({ status: status || undefined, q: q || undefined, page, limit: 20 });
  const [update, state] = useAdminUpdateSellerMutation();
  const { data: queue } = useAdminDocumentQueueQuery();
  const [reviewing, setReviewing] = useState<{ id: string; shopName: string } | null>(null);
  const pendingDocs = new Map((queue ?? []).map((q) => [q.sellerId, q.pending]));

  const act = async (id: string, body: { status?: SellerStatus; commissionRate?: number }) => {
    try {
      await update({ id, ...body }).unwrap();
      toast.success('Seller updated');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader title="Sellers" description="Approve new shops, suspend sellers and set each shop’s default commission. A rate set on a category (Categories page) takes priority." />
      {queue && queue.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <FileText className="size-4" />
          <span className="flex-1">Documents waiting for review:</span>
          {queue.map((q) => (
            <Button key={q.sellerId} size="sm" variant="ghost" onClick={() => setReviewing({ id: q.sellerId, shopName: q.shopName })}>
              {q.shopName} ({q.pending})
            </Button>
          ))}
        </div>
      )}
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3">
          <input className="input max-w-xs" placeholder="Shop or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value as SellerStatus | ''); setPage(1); }}>
            <option value="">All</option>
            {SELLER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Shop', 'Owner', 'Products', 'Default commission %', 'Status', 'Joined', '']} empty={!data?.items.length ? <EmptyState icon={<Store />} title="No sellers" /> : null}>
            {data?.items.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {s.shopName} {s.isHouseStore && <Badge tone="primary">House</Badge>}{' '}
                    {s.verifiedAt && !s.isHouseStore && (
                      <span title="Verified seller" className="inline-flex align-middle text-green-700">
                        <BadgeCheck className="size-4" />
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-500">{s.phone}</p>
                </td>
                <td className="px-4 py-3 text-xs">{s.owner.name}<br />{s.owner.email}</td>
                <td className="px-4 py-3">{s.productCount}</td>
                <td className="px-4 py-3">
                  <input
                    className="input h-8 w-20"
                    defaultValue={s.commissionRate}
                    inputMode="decimal"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && v >= 0 && v <= 100 && v !== s.commissionRate) void act(s.id, { commissionRate: v });
                    }}
                  />
                </td>
                <td className="px-4 py-3"><Badge tone={TONE[s.status]}>{s.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(s.createdAt)}</td>
                <td className="px-4 py-3">
                  {!s.isHouseStore && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setReviewing({ id: s.id, shopName: s.shopName })}>
                        Documents{pendingDocs.get(s.id) ? <Badge tone="warning">{pendingDocs.get(s.id)}</Badge> : null}
                      </Button>
                      {s.status !== 'APPROVED' && <Button size="sm" loading={state.isLoading} onClick={() => void act(s.id, { status: 'APPROVED' })}>Approve</Button>}
                      {s.status === 'APPROVED' && <Button size="sm" variant="danger" onClick={() => confirm(`Suspend ${s.shopName}?`) && void act(s.id, { status: 'SUSPENDED' })}>Suspend</Button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
      </div>
      {reviewing && <SellerDocumentsReview key={reviewing.id} sellerId={reviewing.id} shopName={reviewing.shopName} onClose={() => setReviewing(null)} />}
    </div>
  );
}
