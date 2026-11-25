'use client';

import { errorMessage, useAdminResolveDisputeMutation } from '@marketbd/api-client';
import type { SubOrderView } from '@marketbd/shared';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@marketbd/ui';

/** Admin order page: own-courier info and the customer's "not received" complaint for one package. */
export function PackageDelivery({ orderId, sub }: { orderId: string; sub: SubOrderView }) {
  const [resolve, state] = useAdminResolveDisputeMutation();
  const [note, setNote] = useState('');
  if (sub.fulfillment !== 'SELLER' && !sub.dispute) return null;

  const decide = async (resolution: 'DELIVERED' | 'NOT_DELIVERED') => {
    try {
      await resolve({ orderId, subOrderId: sub.id, resolution, note: note.trim() || undefined }).unwrap();
      toast.success(resolution === 'NOT_DELIVERED' ? 'Marked not delivered — refund the customer from Payments' : 'Marked delivered');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-ink-100 pt-3 text-xs">
      {sub.fulfillment === 'SELLER' && (
        <p className="text-ink-600">
          Delivered by the shop’s own courier: <b>{sub.courierName}</b>
          {sub.trackingNumber ? ` · tracking ${sub.trackingNumber}` : ''}
          {sub.sellerCollectsCash ? ' · COD cash collected by the shop' : ''}
        </p>
      )}
      {sub.dispute && (
        <div className="rounded-md bg-red-50 p-3 text-red-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-4" /> Customer says it was not received
          </p>
          <p className="mt-1">“{sub.dispute.note}”</p>
          {sub.dispute.resolution ? (
            <p className="mt-1 font-medium">Resolved: {sub.dispute.resolution === 'DELIVERED' ? 'delivered' : 'not delivered'}</p>
          ) : (
            <div className="mt-2 space-y-2">
              <input className="input h-8 bg-white text-xs" placeholder="Note for the customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" loading={state.isLoading} onClick={() => void decide('DELIVERED')}>
                  It was delivered
                </Button>
                <Button size="sm" variant="danger" loading={state.isLoading} onClick={() => void decide('NOT_DELIVERED')}>
                  Not delivered
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
