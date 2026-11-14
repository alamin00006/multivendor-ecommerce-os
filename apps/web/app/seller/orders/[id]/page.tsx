'use client';

import { errorMessage, useSellerOrderQuery, useUpdateSellerOrderMutation } from '@marketbd/api-client';
import { canTransitionOrder, type OrderStatus } from '@marketbd/shared';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AddressBlock, OrderItemRow, OrderTimeline, PageHeader, useI18n, Button, ErrorState, Skeleton, OrderStatusBadge, PaymentStatusBadge } from '@marketbd/ui';

const SELLER_TARGETS: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export default function SellerOrderPage() {
  const { money } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, isError, refetch } = useSellerOrderQuery(id);
  const [updateStatus, state] = useUpdateSellerOrderMutation();
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');

  if (isError) return <ErrorState message="Order not found" onRetry={() => void refetch()} />;
  if (isLoading || !order) return <Skeleton className="h-96" />;

  const next = SELLER_TARGETS.filter((s) => canTransitionOrder(order.status, s));

  const move = async (status: OrderStatus) => {
    if (status === 'CANCELLED' && !confirm('Cancel this package? Stock will be returned.')) return;
    try {
      await updateStatus({ id, status, note: note || undefined, trackingNumber: tracking || undefined }).unwrap();
      toast.success(`Marked as ${status.toLowerCase()}`);
      setNote('');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        actions={
          <div className="flex gap-2">
            <PaymentStatusBadge status={order.paymentStatus} />
            <OrderStatusBadge status={order.status} />
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section className="card p-4">
            <h3 className="mb-2 font-semibold">Items</h3>
            <ul className="divide-y divide-ink-100">
              {order.items.map((i) => (
                <OrderItemRow key={i.id} item={i} />
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-ink-100 pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd>{money(order.shippingFee)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
              <div className="flex justify-between text-ink-500"><dt>Platform commission</dt><dd>-{money(order.commissionAmount)}</dd></div>
            </dl>
          </section>
          <section className="card p-4">
            <h3 className="mb-3 font-semibold">Timeline</h3>
            <OrderTimeline events={order.history} current={order.status} />
          </section>
        </div>
        <div className="space-y-4">
          <section className="card p-4">
            <h3 className="mb-2 font-semibold">Ship to</h3>
            <AddressBlock address={order.shippingAddress} />
            <p className="mt-2 text-xs text-ink-500">Payment: {order.paymentMethod}</p>
          </section>
          <section className="card space-y-3 p-4">
            <h3 className="font-semibold">Fulfilment</h3>
            {next.length === 0 ? (
              <p className="text-sm text-ink-500">No further action is needed for this package.</p>
            ) : (
              <>
                {next.includes('SHIPPED') && (
                  <input className="input" placeholder="Courier tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                )}
                <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {next.map((s) => (
                    <Button key={s} size="sm" variant={s === 'CANCELLED' ? 'danger' : 'primary'} loading={state.isLoading} onClick={() => void move(s)}>
                      {s === 'CANCELLED' ? 'Cancel' : `Mark ${s.toLowerCase()}`}
                    </Button>
                  ))}
                </div>
              </>
            )}
            {order.trackingNumber && <p className="text-xs text-ink-500">Tracking: {order.trackingNumber}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
