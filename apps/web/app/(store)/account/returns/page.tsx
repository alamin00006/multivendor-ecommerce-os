'use client';

import { errorMessage, useMyReturnsQuery, useRequestReturnMutation, useReturnableOrdersQuery } from '@marketbd/api-client';
import { type MyReturnView, type ReturnableOrder, ReturnRequestSchema, type ReturnStatus } from '@marketbd/shared';
import { Check, PackageOpen, RotateCcw, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { useI18n, Badge, Button, cn, ImageListField, Modal, Skeleton } from '@marketbd/ui';

type Tab = 'all' | 'initiate' | 'track';

const TONE: Record<ReturnStatus, 'warning' | 'info' | 'danger' | 'success'> = {
  REQUESTED: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  RECEIVED: 'info',
  REFUNDED: 'success',
};
const LABEL: Record<ReturnStatus, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved — send the item back',
  REJECTED: 'Rejected',
  RECEIVED: 'Item received',
  REFUNDED: 'Refunded',
};
const STEPS: { status: ReturnStatus; label: string }[] = [
  { status: 'REQUESTED', label: 'Requested' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'RECEIVED', label: 'Item received' },
  { status: 'REFUNDED', label: 'Refunded' },
];
const OPEN: ReturnStatus[] = ['REQUESTED', 'APPROVED', 'RECEIVED'];
const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <PackageOpen className="size-28 text-ink-300" strokeWidth={1.2} />
      <p className="mt-5 text-xl font-semibold text-ink-900">{title}</p>
      <p className="mt-1.5 text-sm text-ink-600">{text}</p>
      <Link
        href="/"
        className="mt-4 w-full max-w-sm rounded-full bg-gradient-to-r from-primary-700 to-accent-500 py-2.5 text-center font-semibold text-white hover:opacity-95"
      >
        Start Shopping
      </Link>
    </div>
  );
}

function Thumbs({ items }: { items: { title: string; imageUrl: string | null; quantity: number }[] }) {
  return (
    <div className="space-y-2">
      {items.map((i, n) => (
        <div key={`${i.title}-${n}`} className="flex items-center gap-3 text-sm">
          <span className="relative size-12 shrink-0 overflow-hidden rounded bg-ink-50">
            {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="48px" className="object-cover" />}
          </span>
          <span className="line-clamp-2 min-w-0 flex-1 text-ink-800">{i.title}</span>
          <span className="shrink-0 text-ink-500">× {i.quantity}</span>
        </div>
      ))}
    </div>
  );
}

function ReturnCard({ r, children }: { r: MyReturnView; children?: ReactNode }) {
  return (
    <li className="rounded-lg border border-ink-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5 text-sm">
        <span>
          Order{' '}
          <Link href={`/account/orders/${r.orderId}`} className="font-semibold text-primary-700 hover:underline">
            {r.orderNumber}
          </Link>
          {r.shopName && <span className="text-ink-500"> · {r.shopName}</span>}
          <span className="ml-2 text-ink-400">Requested {date(r.createdAt)}</span>
        </span>
        <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
      </div>
      <div className="space-y-3 px-4 py-3">
        <Thumbs items={r.items} />
        <p className="text-sm text-ink-700">
          <span className="text-ink-500">Reason:</span> {r.reason}
        </p>
        {r.sellerNote && <p className="rounded bg-ink-50 px-3 py-2 text-xs text-ink-600">Note from the shop: {r.sellerNote}</p>}
        {r.adminNote && <p className="rounded bg-ink-50 px-3 py-2 text-xs text-ink-600">Note from MarketBD: {r.adminNote}</p>}
        {children}
      </div>
    </li>
  );
}

/** Requested → Approved → Item received → Refunded, or a rejection note. */
function Progress({ r }: { r: MyReturnView }) {
  if (r.status === 'REJECTED') {
    return (
      <p className="flex items-center gap-2 text-sm text-danger">
        <X className="size-4" /> This return was rejected{(r.sellerNote ?? r.adminNote) ? ` — ${r.sellerNote ?? r.adminNote}` : ''}.
      </p>
    );
  }
  const reached = STEPS.findIndex((s) => s.status === r.status);
  return (
    <ol className="flex items-start" aria-label="Return progress">
      {STEPS.map((s, i) => {
        const done = i <= reached;
        return (
          <li key={s.status} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={cn('absolute right-1/2 top-3 h-0.5 w-full', i <= reached ? 'bg-primary-600' : 'bg-ink-200')} />}
            <span className={cn('relative z-10 grid size-6 place-items-center rounded-full border-2', done ? 'border-primary-600 bg-primary-600 text-white' : 'border-ink-300 bg-white')}>
              {done && <Check className="size-3.5" />}
            </span>
            <span className={cn('mt-1.5 text-xs', i === reached ? 'font-semibold text-primary-700' : done ? 'text-ink-700' : 'text-ink-400')}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function RequestForm({ order, subOrderId, onDone }: { order: ReturnableOrder; subOrderId: string; onDone: () => void }) {
  const [request, state] = useRequestReturnMutation();
  const [reason, setReason] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pkg = order.packages.find((p) => p.subOrderId === subOrderId);

  const submit = async () => {
    const parsed = ReturnRequestSchema.safeParse({ reason, subOrderId, imageUrls: images });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form');
    setError(null);
    try {
      await request({ id: order.orderId, ...parsed.data }).unwrap();
      toast.success('Return requested — we will update you here');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      {pkg && <Thumbs items={pkg.items} />}
      <div>
        <label className="label" htmlFor="return-reason">What is wrong with the item?</label>
        <textarea
          id="return-reason"
          className="input h-24 py-2"
          maxLength={1000}
          placeholder="e.g. Wrong size delivered, item damaged, not as described…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <p className="field-error">{error}</p>}
      </div>
      <div>
        <span className="label">Photos (optional, up to 5)</span>
        <ImageListField value={images} onChange={setImages} folder="returns" max={5} coverLabel={false} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button loading={state.isLoading} onClick={() => void submit()}>
          Request return
        </Button>
      </div>
    </div>
  );
}

/** Returns hub like the reference: every request, orders that can be returned, and live progress. */
export default function MyReturnsPage() {
  const { money } = useI18n();
  const [tab, setTab] = useState<Tab>('all');
  const [requesting, setRequesting] = useState<{ order: ReturnableOrder; subOrderId: string } | null>(null);
  const { data: returns, isLoading: loadingReturns } = useMyReturnsQuery({ page: 1, limit: 50 });
  const { data: returnable = [], isLoading: loadingReturnable } = useReturnableOrdersQuery();
  const all = returns?.items ?? [];
  const open = all.filter((r) => OPEN.includes(r.status));
  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All Return' },
    { key: 'initiate', label: 'Initiate Return' },
    { key: 'track', label: 'Track Return' },
  ];
  const loading = tab === 'initiate' ? loadingReturnable : loadingReturns;

  return (
    <div className="min-h-[560px] rounded-lg bg-white p-5 shadow-card md:p-6">
      <h1 className="border-b border-ink-100 pb-4 text-2xl font-semibold text-ink-900">Returns</h1>
      <div className="scrollbar-none flex gap-6 overflow-x-auto border-b border-ink-100" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px shrink-0 border-b-2 py-3.5 text-sm transition',
              tab === t.key ? 'border-accent-500 font-medium text-accent-600' : 'border-transparent text-ink-500 hover:text-ink-900',
            )}
          >
            {t.label}
            {t.key === 'initiate' && returnable.length > 0 && <span className="ml-1.5 rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">{returnable.length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-40" />
      ) : tab === 'all' ? (
        all.length ? (
          <ul className="space-y-3 pt-4">
            {all.map((r) => (
              <ReturnCard key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <Empty title="No returns yet" text="Your return requests will appear here." />
        )
      ) : tab === 'initiate' ? (
        returnable.length ? (
          <ul className="space-y-3 pt-4">
            {returnable.map((o) => (
              <li key={o.orderId} className="rounded-lg border border-ink-100">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5 text-sm">
                  <span>
                    Order{' '}
                    <Link href={`/account/orders/${o.orderId}`} className="font-semibold text-primary-700 hover:underline">
                      {o.orderNumber}
                    </Link>
                    {o.deliveredAt && <span className="ml-2 text-ink-400">Delivered {date(o.deliveredAt)}</span>}
                  </span>
                  {o.returnBy && <span className="text-xs font-medium text-accent-600">Return by {date(o.returnBy)}</span>}
                </div>
                <div className="divide-y divide-ink-100">
                  {o.packages.map((p) => (
                    <div key={p.subOrderId} className="flex flex-wrap items-end gap-4 px-4 py-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        {p.shopName && <p className="text-xs font-semibold text-ink-500">{p.shopName}</p>}
                        <Thumbs items={p.items} />
                      </div>
                      <div className="text-right">
                        <p className="mb-2 text-sm font-semibold text-ink-900">{money(p.items.reduce((s, i) => s + i.lineTotal, 0))}</p>
                        <Button size="sm" onClick={() => setRequesting({ order: o, subOrderId: p.subOrderId })}>
                          <RotateCcw className="size-4" /> Return
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No items to return" text="Delivered orders that are still inside the return window appear here." />
        )
      ) : open.length ? (
        <ul className="space-y-3 pt-4">
          {open.map((r) => (
            <ReturnCard key={r.id} r={r}>
              <div className="pt-2">
                <Progress r={r} />
              </div>
            </ReturnCard>
          ))}
        </ul>
      ) : (
        <Empty title="No Items to track" text="You don't have any returns in progress at the moment." />
      )}

      <Modal open={requesting !== null} onClose={() => setRequesting(null)} title="Request a return" size="lg">
        {requesting && (
          <RequestForm
            order={requesting.order}
            subOrderId={requesting.subOrderId}
            onDone={() => {
              setRequesting(null);
              setTab('track');
            }}
          />
        )}
      </Modal>
    </div>
  );
}
