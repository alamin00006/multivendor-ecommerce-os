'use client';

import {
  errorMessage,
  useCancelOrderMutation,
  useCreateReviewMutation,
  useInitiatePaymentMutation,
  useMarketplaceMode,
  useOrderQuery,
  useRequestReturnMutation,
} from '@marketbd/api-client';
import type { OrderItemView } from '@marketbd/shared';
import { Star, Store } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AddressBlock, OrderItemRow, OrderTimeline } from '@/components/account/order-parts';
import { useI18n } from '@/i18n/client';
import { Badge, Button, cn, ErrorState, Modal, Skeleton } from '@/components/ui';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/status';

function ReviewModal({ item, onClose }: { item: OrderItemView; onClose: () => void }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [create, state] = useCreateReviewMutation();
  return (
    <Modal open onClose={onClose} title={t.account.writeReview}>
      <p className="mb-3 line-clamp-2 text-sm">{item.title}</p>
      <p className="label">{t.account.yourRating}</p>
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n}`}>
            <Star className={cn('size-8', n <= rating ? 'fill-warning text-warning' : 'text-ink-300')} />
          </button>
        ))}
      </div>
      <label className="label" htmlFor="comment">{t.account.yourReview}</label>
      <textarea id="comment" className="input h-28 py-2" maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button
        block
        className="mt-4"
        loading={state.isLoading}
        onClick={async () => {
          try {
            await create({ productId: item.productId, rating, comment: comment || undefined }).unwrap();
            toast.success(t.account.submitReview);
            onClose();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      >
        {t.account.submitReview}
      </Button>
    </Modal>
  );
}

export default function OrderDetailPage() {
  const { t, money, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { showSellerInfo } = useMarketplaceMode();
  const { data: order, isLoading, isError, refetch } = useOrderQuery(id);
  const [cancel, cancelState] = useCancelOrderMutation();
  const [requestReturn, returnState] = useRequestReturnMutation();
  const [pay, payState] = useInitiatePaymentMutation();
  const [dialog, setDialog] = useState<'cancel' | 'return' | null>(null);
  const [reason, setReason] = useState('');
  const [reviewing, setReviewing] = useState<OrderItemView | null>(null);

  if (isError) return <ErrorState message={t.common.error} onRetry={() => void refetch()} />;
  if (isLoading || !order) return <Skeleton className="h-96" />;

  const submitDialog = async () => {
    try {
      if (dialog === 'cancel') await cancel({ id, reason }).unwrap();
      else await requestReturn({ id, reason }).unwrap();
      toast.success(t.common.save);
      setDialog(null);
      setReason('');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <section className="card flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <h1 className="font-semibold">
            {t.account.orderNumber} {order.orderNumber}
          </h1>
          <p className="text-sm text-ink-500">
            {t.account.placedOn} {new Date(order.createdAt).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentStatusBadge status={order.paymentStatus} />
          <OrderStatusBadge status={order.status} />
          {order.canPay && (
            <Button
              size="sm"
              variant="accent"
              loading={payState.isLoading}
              onClick={async () => {
                try {
                  const r = await pay({ orderId: order.id, client: 'web' }).unwrap();
                  if (r.redirectUrl) window.location.assign(r.redirectUrl);
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              {t.account.payNow}
            </Button>
          )}
          {order.canCancel && (
            <Button size="sm" variant="outline" onClick={() => setDialog('cancel')}>
              {t.account.cancelOrder}
            </Button>
          )}
          {order.canReturn && (
            <Button size="sm" variant="outline" onClick={() => setDialog('return')}>
              {t.account.requestReturn}
            </Button>
          )}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">{t.account.timeline}</h2>
        <OrderTimeline events={order.history} current={order.status} />
      </section>

      {order.subOrders.map((sub, i) => (
        <section key={sub.id} className="card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <Store className="size-4 text-primary-700" /> {t.checkout.package} {i + 1}
              {showSellerInfo && sub.seller && <span className="font-normal text-ink-500">· {sub.seller.shopName}</span>}
            </span>
            <span className="flex items-center gap-2">
              {sub.trackingNumber && <Badge>#{sub.trackingNumber}</Badge>}
              <OrderStatusBadge status={sub.status} />
            </span>
          </div>
          <ul className="divide-y divide-ink-100">
            {sub.items.map((item) => (
              <OrderItemRow
                key={item.id}
                item={item}
                action={
                  sub.status === 'DELIVERED' && !item.reviewed ? (
                    <Button size="sm" variant="soft" onClick={() => setReviewing(item)}>
                      {t.account.writeReview}
                    </Button>
                  ) : null
                }
              />
            ))}
          </ul>
        </section>
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">{t.checkout.shippingAddress}</h2>
          <AddressBlock address={order.shippingAddress} />
        </section>
        <section className="card p-4 text-sm">
          <h2 className="mb-2 font-semibold">{t.cart.summary}</h2>
          <dl className="space-y-1.5">
            <div className="flex justify-between"><dt className="text-ink-500">{t.cart.subtotal}</dt><dd>{money(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">{t.cart.shipping}</dt><dd>{money(order.shippingFee)}</dd></div>
            {order.discount > 0 && (
              <div className="flex justify-between text-success"><dt>{t.cart.discount} {order.couponCode && `(${order.couponCode})`}</dt><dd>-{money(order.discount)}</dd></div>
            )}
            <div className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><dt>{t.cart.total}</dt><dd className="text-accent-600">{money(order.total)}</dd></div>
            <div className="flex justify-between pt-1"><dt className="text-ink-500">{t.checkout.payment}</dt><dd>{t.checkout.methods[order.paymentMethod]}</dd></div>
          </dl>
        </section>
      </div>

      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={dialog === 'cancel' ? t.account.cancelOrder : t.account.requestReturn}>
        <label className="label" htmlFor="reason">{dialog === 'cancel' ? t.account.cancelReason : t.account.returnReason}</label>
        <textarea id="reason" className="input h-28 py-2" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button
          block
          className="mt-4"
          variant={dialog === 'cancel' ? 'danger' : 'primary'}
          disabled={reason.trim().length < (dialog === 'cancel' ? 3 : 10)}
          loading={cancelState.isLoading || returnState.isLoading}
          onClick={() => void submitDialog()}
        >
          {dialog === 'cancel' ? t.account.cancelOrder : t.account.requestReturn}
        </Button>
      </Modal>
      {reviewing && <ReviewModal item={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}
