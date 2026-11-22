'use client';

import { errorMessage, useAdminPayoutsQuery, useAdminProcessPayoutMutation } from '@marketbd/api-client';
import { type PayoutStatus, type PayoutView } from '@marketbd/shared';
import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, cn, EmptyState, fmtDate, Modal, PageHeader, Pager, Skeleton, Table, useI18n } from '@marketbd/ui';

const METHOD_LABEL = { BKASH: 'bKash', NAGAD: 'Nagad', BANK: 'Bank' } as const;
const STATUS_TONE = { REQUESTED: 'warning', PAID: 'success', REJECTED: 'danger' } as const;
const TABS: Array<[PayoutStatus | '', string]> = [
  ['REQUESTED', 'Waiting'],
  ['PAID', 'Paid'],
  ['REJECTED', 'Rejected'],
  ['', 'All'],
];

function ProcessModal({ payout, onClose }: { payout: PayoutView; onClose: () => void }) {
  const { money } = useI18n();
  const [process, state] = useAdminProcessPayoutMutation();
  const [mode, setMode] = useState<'PAID' | 'REJECTED'>('PAID');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const submit = async () => {
    try {
      await process({ id: payout.id, status: mode, reference: reference.trim() || undefined, adminNote: note.trim() || undefined }).unwrap();
      toast.success(mode === 'PAID' ? 'Marked as paid — the seller was notified' : 'Request rejected');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-ink-50 p-3 text-sm">
        <p className="text-2xl font-bold">{money(payout.amount)}</p>
        <p className="mt-1 font-semibold">{payout.seller?.shopName}</p>
        <p>
          {METHOD_LABEL[payout.method]} · {payout.accountName}
        </p>
        <p className="font-mono">{payout.accountNumber}</p>
        {payout.bankName && (
          <p>
            {payout.bankName}
            {payout.branch ? `, ${payout.branch}` : ''}
          </p>
        )}
        {payout.sellerNote && <p className="mt-2 text-ink-600">“{payout.sellerNote}”</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['PAID', 'REJECTED'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cn('rounded-lg border p-2.5 text-sm font-medium', mode === m ? (m === 'PAID' ? 'border-primary-700 bg-primary-50 text-primary-800' : 'border-danger bg-red-50 text-danger') : 'border-ink-200')}
          >
            {m === 'PAID' ? 'I have sent the money' : 'Reject request'}
          </button>
        ))}
      </div>
      {mode === 'PAID' && (
        <label className="block">
          <span className="label">Transaction ID / reference</span>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. bKash TrxID" />
        </label>
      )}
      <label className="block">
        <span className="label">{mode === 'PAID' ? 'Note (optional)' : 'Reason (shown to the seller)'}</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button variant={mode === 'PAID' ? 'primary' : 'danger'} loading={state.isLoading} disabled={mode === 'PAID' ? !reference.trim() : !note.trim()} onClick={() => void submit()}>
          {mode === 'PAID' ? 'Mark as paid' : 'Reject'}
        </Button>
      </div>
    </div>
  );
}

/** Admin → Payouts: seller withdrawal requests. */
export default function AdminPayoutsPage() {
  const { money } = useI18n();
  const [status, setStatus] = useState<PayoutStatus | ''>('REQUESTED');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<PayoutView | null>(null);
  const { data, isLoading } = useAdminPayoutsQuery({ status: status || undefined, page, limit: 20 });

  return (
    <div>
      <PageHeader title="Seller payouts" description="Send sellers their cleared earnings, then mark the request as paid." />
      <div className="card">
        <div className="flex gap-1 border-b border-ink-100 px-3" role="tablist">
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
              className={cn('-mb-px border-b-2 px-3 py-3 text-sm', status === k ? 'border-primary-700 font-semibold text-primary-700' : 'border-transparent text-ink-500 hover:text-ink-800')}
            >
              {label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Shop', 'Amount', 'Send to', 'Balance left', 'Requested', 'Status', '']} empty={!data?.items.length ? <EmptyState icon={<Wallet />} title="No payout requests" /> : null}>
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">{p.seller?.shopName}</td>
                <td className="px-4 py-3 font-semibold">{money(p.amount)}</td>
                <td className="px-4 py-3 text-xs">
                  {METHOD_LABEL[p.method]} · {p.accountName}
                  <br />
                  <span className="font-mono text-ink-500">{p.accountNumber}</span>
                </td>
                <td className="px-4 py-3 text-xs text-ink-600">{p.seller ? money(p.seller.available) : '—'}</td>
                <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(p.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[p.status]}>{p.status === 'REQUESTED' ? 'Waiting' : p.status === 'PAID' ? 'Paid' : 'Rejected'}</Badge>
                  {p.reference && <p className="mt-1 text-xs text-ink-500">Ref {p.reference}</p>}
                  {p.status === 'REJECTED' && p.adminNote && <p className="mt-1 text-xs text-ink-500">{p.adminNote}</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  {p.status === 'REQUESTED' && (
                    <Button size="sm" onClick={() => setOpen(p)}>
                      Process
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
      </div>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="Process payout">
        {open && <ProcessModal payout={open} onClose={() => setOpen(null)} />}
      </Modal>
    </div>
  );
}
