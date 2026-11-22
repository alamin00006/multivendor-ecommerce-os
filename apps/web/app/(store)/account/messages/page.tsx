'use client';

import { Suspense } from 'react';
import { ChatInbox, PageHeader, Skeleton } from '@marketbd/ui';

export default function MessagesPage() {
  return (
    <div>
      <PageHeader title="Messages" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ChatInbox scope="customer" />
      </Suspense>
    </div>
  );
}
