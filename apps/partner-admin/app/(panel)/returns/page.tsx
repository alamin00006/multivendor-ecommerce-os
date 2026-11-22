'use client';

import { errorMessage, useSellerReturnsQuery, useSellerUpdateReturnMutation } from '@marketbd/api-client';
import { BRAND } from '@marketbd/shared';
import type { ReturnStatus, SellerReturnView } from '@marketbd/shared';
import { ImageOff, PackageCheck, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, cn, EmptyState, fmtDate, Modal, PageHeader, Pager, Skeleton, useI18n } from '@marketbd/ui';

const TABS: Array<[ReturnStatus | '', string]> = [
  ['REQUESTED', 'New'],
  ['APPROVED', 'Approved'],
  ['RECEIVED', 'Received'],
  ['REFUNDED', 'Refunded'],
  ['REJECTED', 'Rejected'],
  ['', 'All'],
];
const TONE = { REQUESTED: 'warning', APPROVED: 'info', RECEIVED: 'primary', REFUNDED: 'success', REJECTED: 'danger' } as const;
const LABEL = { REQUESTED: 'New request', APPROVED: 'Approved — awaiting parcel', RECEIVED: 'Received — refund pending', REFUNDED: 'Refunded', REJECTED: 'Rejected' } as const;

type Action = 'APPROVED' | 'REJECTED' | 'RECEIVED';
const ACTION_TEXT: Record<Action, { title: string; button: string; note: string }> = {
  APPROVED: { title: 'Approve return', button: 'Approve', note: 'Instructions for the customer (optional)' },
  REJECTED: { title: 'Reject return', button: 'Reject', note: 'Reason (shown to the customer)' },
  RECEIVED: { title: 'Mark parcel received', button: 'Confirm received', note: 'Condition of the item (optional)' },
};

function ActionModal({ ret, action, onClose }: { ret: SellerReturnView; action: Action; onClose: () => void }) {
  const [update, state] = useSellerUpdateReturnMutation();
  const [note, setNote] = useState('');
  const text = ACTION_TEXT[action];
  const submit = async () => {
    try {
      await update({ id: ret.id, status: action, sellerNote: note.trim() || undefined }).unwrap();
      toast.success(action === 'RECEIVED' ? 'Marked as received — stock was added back' : `Return ${action.toLowerCase()}`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Modal open onClose={onClose} title={text.title}>
      <div className="space-y-4">
        {action === 'RECEIVED' && <p className="rounded-lg bg-primary-50 p-3 text-sm text-primary-800">The items go back into stock and admin is told to refund the customer.</p>}
        <label className="block">
          <span className="label">{text.note}</span>
          <textarea className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={action === 'REJECTED' ? 'danger' : 'primary'} loading={state.isLoading} disabled={action === 'REJECTED' && !note.trim()} onClick={() => void submit()}>
            {text.button}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReturnCard({ r, onAction }: { r: SellerReturnView; onAction: (a: Action) => void }) {
  const { money } = useI18n();
  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm">
            Order{' '}
            {r.subOrderId ? (
              <Link href={`/orders/${r.subOrderId}`} className="font-semibold text-primary-700">
                {r.orderNumber}
              </Link>
            ) : (
              <span className="font-semibold">{r.orderNumber}</span>
            )}
          </p>
          <p className="text-xs text-ink-500">
            {r.customer.name}
            {r.customer.phone ? ` · ${r.customer.phone}` : ''} · requested {fmtDate(r.createdAt)}
          </p>
        </div>
        <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
      </div>

      {r.items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {r.items.map((i, n) => (
            <li key={n} className="flex items-center gap-3 text-sm">
              {i.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.imageUrl} alt="" className="size-12 rounded-md object-cover" />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-md bg-ink-50 text-ink-300">
                  <ImageOff className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.title}</p>
                <p className="text-xs text-ink-500">
                  {i.variantLabel !== 'Default' ? `${i.variantLabel} · ` : ''}Qty {i.quantity}
                </p>
              </div>
              <span className="font-semibold">{money(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 rounded-lg bg-ink-50 p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Customer’s reason</p>
        <p className="mt-0.5">{r.reason}</p>
        {r.imageUrls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {r.imageUrls.map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="Return photo" className="size-16 rounded-md object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>
      {(r.sellerNote || r.adminNote) && (
        <div className="mt-2 space-y-1 text-xs text-ink-600">
          {r.sellerNote && <p>Your note: {r.sellerNote}</p>}
          {r.adminNote && <p>Admin: {r.adminNote}</p>}
        </div>
      )}

      {!r.canAct ? (
        <p className="mt-3 text-xs text-ink-500">This is a return for the whole order — {BRAND.name} support handles it.</p>
      ) : (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {r.status === 'REQUESTED' && (
            <>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => onAction('REJECTED')}>
                <ThumbsDown className="size-4" /> Reject
              </Button>
              <Button size="sm" onClick={() => onAction('APPROVED')}>
                <ThumbsUp className="size-4" /> Approve
              </Button>
            </>
          )}
          {r.status === 'APPROVED' && (
            <>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => onAction('REJECTED')}>
                Reject
              </Button>
              <Button size="sm" onClick={() => onAction('RECEIVED')}>
                <PackageCheck className="size-4" /> Parcel received
              </Button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** Seller Center → Returns: approve / reject customer returns and confirm when the parcel is back. */
export default function SellerReturnsPage() {
  const [status, setStatus] = useState<ReturnStatus | ''>('REQUESTED');
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<{ ret: SellerReturnView; action: Action } | null>(null);
  const { data, isLoading, isFetching } = useSellerReturnsQuery({ status: status || undefined, page, limit: 10 });

  return (
    <div>
      <PageHeader title="Returns" description="Approve or reject return requests, then confirm when the item is back. Admin issues the refund." />
      <div className="card mb-3 flex gap-1 overflow-x-auto px-3" role="tablist">
        {TABS.map(([k, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={status === k}
            onClick={() => {
              setStatus(k);
              setPage(1);
            }}
            className={cn('-mb-px shrink-0 border-b-2 px-3 py-3 text-sm', status === k ? 'border-primary-700 font-semibold text-primary-700' : 'border-transparent text-ink-500 hover:text-ink-800')}
          >
            {label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState icon={<RotateCcw />} title="No returns here" text="Return requests on your packages will show up here." />
        </div>
      ) : (
        <div className={cn('space-y-3', isFetching && 'opacity-60')}>
          {data.items.map((r) => (
            <ReturnCard key={r.id} r={r} onAction={(action) => setActing({ ret: r, action })} />
          ))}
        </div>
      )}
      {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
      {acting && <ActionModal ret={acting.ret} action={acting.action} onClose={() => setActing(null)} />}
    </div>
  );
}
