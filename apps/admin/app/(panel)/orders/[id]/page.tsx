'use client';

import { errorMessage, useAdminOrderQuery, useAdminRefundMutation, useAdminSetOrderStatusMutation, useMarketplaceMode } from '@marketbd/api-client';
import { fromPoisha, ORDER_STATUSES, type OrderStatus, toPoisha } from '@marketbd/shared';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AddressBlock, OrderItemRow, OrderTimeline, fmtDate, PageHeader, useI18n, Badge, Button, ErrorState, Modal, Skeleton, OrderStatusBadge, PaymentStatusBadge } from '@marketbd/ui';

export default function AdminOrderPage() {
  const { money } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { showSellerInfo } = useMarketplaceMode();
  const { data: order, isLoading, isError, refetch } = useAdminOrderQuery(id);
  const [setStatus, statusState] = useAdminSetOrderStatusMutation();
  const [refund, refundState] = useAdminRefundMutation();
  const [target, setTarget] = useState<{ status: OrderStatus; subOrderId?: string } | null>(null);
  const [note, setNote] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  if (isError) return <ErrorState message="Order not found" onRetry={() => void refetch()} />;
  if (isLoading || !order) return <Skeleton className="h-96" />;

  const paid = order.payments.filter((p) => p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED');
  const refundable = paid.reduce((s, p) => s + p.amount - p.refunds.filter((r) => r.status === 'COMPLETED').reduce((a, r) => a + r.amount, 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`${order.customer?.name ?? ''} · ${fmtDate(order.createdAt)}`}
        actions={
          <>
            <PaymentStatusBadge status={order.paymentStatus} />
            <OrderStatusBadge status={order.status} />
            <select className="input h-9 w-auto" value="" onChange={(e) => e.target.value && setTarget({ status: e.target.value as OrderStatus })}>
              <option value="">Override status…</option>
              {ORDER_STATUSES.filter((s) => s !== order.status).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {refundable > 0 && (
              <Button size="sm" variant="outline" onClick={() => { setAmount(String(fromPoisha(refundable))); setRefunding(true); }}>
                Refund
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {order.subOrders.map((sub, i) => (
            <section key={sub.id} className="card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold">
                  Package {i + 1} {showSellerInfo && sub.seller && <span className="font-normal text-ink-500">· {sub.seller.shopName}</span>}
                </span>
                <span className="flex items-center gap-2">
                  {sub.trackingNumber && <Badge>#{sub.trackingNumber}</Badge>}
                  <OrderStatusBadge status={sub.status} />
                  <select className="input h-8 w-auto text-xs" value="" onChange={(e) => e.target.value && setTarget({ status: e.target.value as OrderStatus, subOrderId: sub.id })}>
                    <option value="">Set…</option>
                    {ORDER_STATUSES.filter((s) => s !== sub.status).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </span>
              </div>
              <ul className="divide-y divide-ink-100">
                {sub.items.map((it) => (
                  <OrderItemRow key={it.id} item={it} />
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-ink-100 pt-2 text-xs text-ink-500">
                <span>Subtotal {money(sub.subtotal)} · Shipping {money(sub.shippingFee)} · Discount {money(sub.discount)}</span>
                {showSellerInfo && <span>Commission {sub.commissionRate}% = {money(sub.commissionAmount)}</span>}
              </p>
            </section>
          ))}
          <section className="card p-4">
            <h3 className="mb-3 font-semibold">Timeline</h3>
            <OrderTimeline events={order.history} current={order.status} />
          </section>
        </div>
        <div className="space-y-4">
          <section className="card p-4">
            <h3 className="mb-2 font-semibold">Customer & delivery</h3>
            <AddressBlock address={order.shippingAddress} />
            {order.note && <p className="mt-2 rounded bg-ink-50 p-2 text-xs">Note: {order.note}</p>}
          </section>
          <section className="card p-4 text-sm">
            <h3 className="mb-2 font-semibold">Payment</h3>
            <dl className="space-y-1">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd>{money(order.shippingFee)}</dd></div>
              <div className="flex justify-between"><dt>Discount {order.couponCode && `(${order.couponCode})`}</dt><dd>-{money(order.discount)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
            </dl>
            <ul className="mt-3 space-y-2 border-t border-ink-100 pt-3 text-xs">
              {order.payments.map((p) => (
                <li key={p.id}>
                  <b>{p.method}</b> {money(p.amount)} · {p.status} {p.gatewayTrxId && `· ${p.gatewayTrxId}`}
                  {p.refunds.map((r) => (
                    <p key={r.id} className="pl-3 text-ink-500">↳ Refund {money(r.amount)} ({r.status}) — {r.reason}</p>
                  ))}
                </li>
              ))}
            </ul>
          </section>
          {order.returns.length > 0 && (
            <section className="card p-4 text-sm">
              <h3 className="mb-2 font-semibold">Returns</h3>
              {order.returns.map((r) => (
                <p key={r.id}><Badge>{r.status}</Badge> {r.reason}</p>
              ))}
            </section>
          )}
        </div>
      </div>

      <Modal open={target !== null} onClose={() => setTarget(null)} title={`Set ${target?.subOrderId ? 'package' : 'order'} to ${target?.status ?? ''}`}>
        <p className="mb-2 text-sm text-ink-600">Cancelling returns stock. The customer is notified.</p>
        <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button
          block
          className="mt-3"
          loading={statusState.isLoading}
          onClick={async () => {
            if (!target) return;
            try {
              await setStatus({ id, subOrderId: target.subOrderId, status: target.status, note: note || undefined }).unwrap();
              toast.success('Status updated');
              setTarget(null);
              setNote('');
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          Confirm
        </Button>
      </Modal>

      <Modal open={refunding} onClose={() => setRefunding(false)} title="Refund payment">
        <p className="mb-3 text-sm text-ink-600">Refundable: {money(refundable)}. Online payments are refunded through the gateway.</p>
        <label className="label" htmlFor="amount">Amount (৳)</label>
        <input id="amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label className="label mt-3" htmlFor="reason">Reason</label>
        <input id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button
          block
          className="mt-4"
          variant="danger"
          disabled={!reason.trim() || !Number(amount)}
          loading={refundState.isLoading}
          onClick={async () => {
            try {
              await refund({ id, amount: toPoisha(Number(amount)), reason }).unwrap();
              toast.success('Refund recorded');
              setRefunding(false);
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          Refund
        </Button>
      </Modal>
    </div>
  );
}
