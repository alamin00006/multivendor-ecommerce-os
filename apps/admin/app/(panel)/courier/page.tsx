'use client';

import { CourierAccountsManager, CourierSettings, PageHeader } from '@marketbd/ui';

export default function AdminCourierPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Couriers"
        description="Switch couriers on, enter their API credentials (stored encrypted) and paste the webhook into each courier's panel. Sellers then book any enabled courier from their orders."
      />
      <CourierAccountsManager />
      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">House store pickup</h2>
        <CourierSettings scope="admin" />
      </div>
    </div>
  );
}
