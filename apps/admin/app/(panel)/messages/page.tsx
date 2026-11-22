'use client';

import { Suspense } from 'react';
import { ChatInbox, PageHeader, Skeleton } from '@marketbd/ui';

export default function MessagesPage() {
  return (
    <div>
      <PageHeader title="Customer messages" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ChatInbox scope="admin" />
      </Suspense>
    </div>
  );
}
