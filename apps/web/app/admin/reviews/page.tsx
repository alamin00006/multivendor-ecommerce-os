'use client';

import { useAdminModerateReviewMutation, useAdminReviewsQuery } from '@marketbd/api-client';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { fmtDate, PageHeader, Pager, Table } from '@/components/manage/panel';
import { Badge, Button, EmptyState, Skeleton, Stars } from '@/components/ui';

export default function AdminReviewsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminReviewsQuery({ page, limit: 20 });
  const [moderate] = useAdminModerateReviewMutation();
  return (
    <div>
      <PageHeader title="Reviews" description="Hidden reviews are excluded from ratings." />
      <div className="card">
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Product', 'Rating', 'Comment', 'By', 'Date', 'Visible']} empty={!data?.items.length ? <EmptyState icon={<MessageSquare />} title="No reviews" /> : null}>
            {data?.items.map((r) => (
              <tr key={r.id}>
                <td className="max-w-48 px-4 py-3 text-xs">
                  {r.product && <Link href={`/p/${r.product.slug}`} className="line-clamp-2 text-primary-700">{r.product.title}</Link>}
                </td>
                <td className="px-4 py-3"><Stars value={r.rating} /></td>
                <td className="max-w-xs px-4 py-3 text-xs">{r.comment}</td>
                <td className="px-4 py-3 text-xs">{r.user.name} {r.isVerifiedPurchase && <Badge tone="success">Verified</Badge>}</td>
                <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant={r.isVisible ? 'ghost' : 'soft'} onClick={() => void moderate({ id: r.id, isVisible: !r.isVisible })}>
                    {r.isVisible ? 'Hide' : 'Show'}
                  </Button>
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
