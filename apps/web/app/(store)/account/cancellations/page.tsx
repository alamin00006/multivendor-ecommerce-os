'use client';

import { errorMessage, useCancelOrderMutation, useMarketplaceMode, useOrdersQuery } from '@marketbd/api-client';
import { BRAND, CancelOrderSchema, type OrderSummary } from '@marketbd/shared';
import { ShoppingBasket } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { useI18n, Button, cn, Modal, OrderStatusBadge, PaymentStatusBadge, Skeleton } from '@marketbd/ui';

const REASONS = ['Changed my mind', 'Found a better price elsewhere', 'Ordered by mistake', 'Delivery takes too long', 'Want to change the address or items'];
const OTHER = 'Other';

function OrderCard({ o, action }: { o: OrderSummary; action?: ReactNode }) {
  const { money, locale } = useI18n();
  const { showSellerInfo } = useMarketplaceMode();
  return (
    <li className="rounded-lg border border-ink-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5 text-sm">
        <span className="min-w-0">
          <Link href={`/account/orders/${o.id}`} className="font-semibold text-primary-700 hover:underline">
            {o.orderNumber}
          </Link>
          <span className="ml-2 text-ink-500">{new Date(o.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium' })}</span>
          <span className="ml-2 text-ink-500">· {showSellerInfo ? o.shopNames.join(', ') : BRAND.name}</span>
        </span>
        <span className="flex gap-2">
          <PaymentStatusBadge status={o.paymentStatus} />
          <OrderStatusBadge status={o.status} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        {o.previewImages.slice(0, 4).map((src) => (
          <Image key={src} src={src} alt="" width={56} height={56} className="size-14 rounded object-cover" />
        ))}
        <span className="ml-auto text-right text-sm">
          <span className="text-ink-500">
            {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}
          </span>
          <br />
          <b className="text-base text-accent-600">{money(o.total)}</b>
        </span>
        {action && <div className="w-full text-right sm:w-auto sm:pl-4">{action}</div>}
      </div>
    </li>
  );
}

function CancelForm({ order, onDone }: { order: OrderSummary; onDone: () => void }) {
  const [cancel, state] = useCancelOrderMutation();
  const [choice, setChoice] = useState(REASONS[0]!);
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = CancelOrderSchema.safeParse({ reason: choice === OTHER ? other : choice });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Tell us why');
    setError(null);
    try {
      await cancel({ id: order.id, ...parsed.data }).unwrap();
      toast.success(`Order ${order.orderNumber} cancelled`);
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-ink-600">
        Order <b className="text-ink-900">{order.orderNumber}</b> will be cancelled for every shop. Items go back in stock, and online payments are
        refunded.
      </p>
      <fieldset className="space-y-2">
        <legend className="label">Why are you cancelling?</legend>
        {[...REASONS, OTHER].map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2.5">
            <input type="radio" name="cancel-reason" className="size-4 accent-primary-700" checked={choice === r} onChange={() => setChoice(r)} />
            {r}
          </label>
        ))}
      </fieldset>
      {choice === OTHER && (
        <textarea
          aria-label="Your reason"
          className="input h-20 py-2"
          maxLength={300}
          placeholder="Tell us a little more…"
          value={other}
          onChange={(e) => setOther(e.target.value)}
        />
      )}
      {error && <p className="field-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Keep order
        </Button>
        <Button variant="danger" loading={state.isLoading} onClick={() => void submit()}>
          Cancel order
        </Button>
      </div>
    </div>
  );
}

/** Orders that can still be cancelled (nothing shipped yet), then past cancellations. */
export default function CancellationsPage() {
  const { data: open, isLoading: loadingOpen } = useOrdersQuery({ cancellable: true, page: 1, limit: 20 });
  const { data: past, isLoading: loadingPast } = useOrdersQuery({ status: 'CANCELLED', page: 1, limit: 20 });
  const [cancelling, setCancelling] = useState<OrderSummary | null>(null);
  const loading = loadingOpen || loadingPast;
  const openItems = open?.items ?? [];
  const pastItems = past?.items ?? [];

  return (
    <div className="min-h-[560px] rounded-lg bg-white p-5 shadow-card md:p-6">
      <h1 className="border-b border-ink-100 pb-4 text-2xl font-semibold text-ink-900">Cancellations</h1>

      {loading ? (
        <Skeleton className="mt-4 h-40" />
      ) : !openItems.length && !pastItems.length ? (
        <div className="flex flex-col items-center px-4 py-16 text-center">
          <ShoppingBasket className="size-28 text-ink-300" strokeWidth={1.25} />
          <p className="mt-5 text-xl font-semibold text-ink-900">No Orders Available for Cancellation</p>
          <p className="mt-1.5 text-sm text-ink-600">Once you place an order, you can manage or cancel it before it ships.</p>
          <Link
            href="/"
            className="mt-4 w-full max-w-sm rounded-full bg-gradient-to-r from-primary-700 to-accent-500 py-2.5 text-center font-semibold text-white hover:opacity-95"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-8 pt-5">
          <section>
            <h2 className="mb-1 font-semibold text-ink-900">Can be cancelled</h2>
            <p className="mb-3 text-xs text-ink-500">You can cancel an order until any part of it ships.</p>
            {openItems.length ? (
              <ul className="space-y-3">
                {openItems.map((o) => (
                  <OrderCard
                    key={o.id}
                    o={o}
                    action={
                      <button
                        type="button"
                        onClick={() => setCancelling(o)}
                        className="rounded-md border border-danger px-4 py-1.5 text-sm font-semibold text-danger hover:bg-red-50"
                      >
                        Cancel order
                      </button>
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className={cn('rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600')}>No orders can be cancelled right now — everything has shipped.</p>
            )}
          </section>

          {pastItems.length > 0 && (
            <section>
              <h2 className="mb-3 font-semibold text-ink-900">Cancelled orders</h2>
              <ul className="space-y-3">
                {pastItems.map((o) => (
                  <OrderCard key={o.id} o={o} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <Modal open={cancelling !== null} onClose={() => setCancelling(null)} title="Cancel this order?">
        {cancelling && <CancelForm order={cancelling} onDone={() => setCancelling(null)} />}
      </Modal>
    </div>
  );
}
