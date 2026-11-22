import { Suspense } from 'react';
import { OrdersList } from '@/components/account/orders-list';

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersList title="My Orders" />
    </Suspense>
  );
}
