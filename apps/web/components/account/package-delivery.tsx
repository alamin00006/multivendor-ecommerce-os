'use client';

import { errorMessage, useReportNotReceivedMutation } from '@marketbd/api-client';
import { DeliveryDisputeSchema, type SubOrderView } from '@marketbd/shared';
import { Copy, PackageX, Truck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Modal } from '@marketbd/ui';

/** Customer order page: who delivers a package, its tracking number, and "I didn't receive it". */
export function PackageDelivery({ orderId, sub }: { orderId: string; sub: SubOrderView }) {
  const [report, state] = useReportNotReceivedMutation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ownCourier = sub.fulfillment === 'SELLER';
  const canReport = sub.status === 'DELIVERED' && !sub.dispute;
  if (!ownCourier && !sub.dispute && !canReport) return null;

  const submit = async () => {
    const parsed = DeliveryDisputeSchema.safeParse({ note });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the note');
    setError(null);
    try {
      await report({ orderId, subOrderId: sub.id, note: parsed.data.note }).unwrap();
      toast.success('Thanks — our team will check with the courier and get back to you');
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-ink-100 pt-3 text-sm">
      {ownCourier && (
        <p className="flex flex-wrap items-center gap-2 text-ink-600">
          <Truck className="size-4 text-primary-700" />
          Delivered by the shop with <b className="text-ink-800">{sub.courierName}</b>
          {sub.trackingNumber && (
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(sub.trackingNumber ?? '').then(() => toast.success('Tracking number copied'))}
              className="inline-flex items-center gap-1 rounded bg-ink-50 px-2 py-0.5 font-mono text-xs text-ink-800 hover:bg-ink-100"
              aria-label="Copy tracking number"
            >
              {sub.trackingNumber} <Copy className="size-3" />
            </button>
          )}
        </p>
      )}
      {sub.dispute ? (
        <p className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-900">
          You reported this package as not received.{' '}
          {sub.dispute.resolution === 'NOT_DELIVERED'
            ? 'We confirmed it was not delivered — your refund is being processed.'
            : sub.dispute.resolution === 'DELIVERED'
              ? 'The courier confirmed the delivery. Contact support if you still need help.'
              : 'Our team is checking with the courier.'}
        </p>
      ) : (
        canReport && (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-danger">
            <PackageX className="size-3.5" /> I didn’t receive this package
          </button>
        )
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Package not received">
        <div className="space-y-3">
          <p className="text-sm text-ink-600">This package is marked delivered. Tell us what happened and we will check with the courier.</p>
          <textarea className="input min-h-24" placeholder="e.g. No one came to my address" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={state.isLoading}>
              Report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
