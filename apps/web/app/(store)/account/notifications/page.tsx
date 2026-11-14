'use client';

import { useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation, useNotificationsQuery } from '@marketbd/api-client';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useI18n, Button, cn, EmptyState, Skeleton } from '@marketbd/ui';

export default function NotificationsPage() {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotificationsQuery({ page, limit: 20 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, markAllState] = useMarkAllNotificationsReadMutation();

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-semibold">{t.common.notifications}</h1>
        <Button size="sm" variant="ghost" loading={markAllState.isLoading} onClick={() => void markAll()}>
          {t.account.markAllRead}
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={<Bell />} title={t.account.noNotifications} />
      ) : (
        <ul className="divide-y divide-ink-100">
          {data.items.map((n) => {
            const orderId = n.data?.orderId;
            const body = (
              <div className={cn('flex gap-3 py-3', !n.readAt && 'font-medium')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-accent-500')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{n.title}</p>
                  <p className="text-sm text-ink-600">{n.body}</p>
                  <p className="text-xs text-ink-400">
                    {new Date(n.createdAt).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={n.id} onClick={() => !n.readAt && void markRead(n.id)}>
                {orderId ? <Link href={`/account/orders/${orderId}`}>{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      )}
      {data && data.meta.totalPages > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
          <span className="self-center text-sm">{page} / {data.meta.totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>›</Button>
        </div>
      )}
    </div>
  );
}
