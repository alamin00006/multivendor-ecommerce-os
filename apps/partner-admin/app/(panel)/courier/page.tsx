'use client';

import { CourierSettings, PageHeader } from '@marketbd/ui';
import { OwnDeliveryCard } from '@/components/own-delivery-card';

export default function SellerCourierPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Courier & delivery" description="Choose who delivers your orders. With MarketBD Delivery you book MarketBD's couriers from a confirmed order." />
      <OwnDeliveryCard />
      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">MarketBD couriers</h2>
        <p className="text-sm text-ink-600">Couriers that collect from your shop need your pickup address.</p>
        <CourierSettings scope="seller" />
      </div>
    </div>
  );
}
