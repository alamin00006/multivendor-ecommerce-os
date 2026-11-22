'use client';

import { CourierSettings, PageHeader } from '@marketbd/ui';

export default function SellerCourierPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Courier" description="Couriers you can book from a confirmed order. Couriers that collect from your shop need your pickup address." />
      <CourierSettings scope="seller" />
    </div>
  );
}
