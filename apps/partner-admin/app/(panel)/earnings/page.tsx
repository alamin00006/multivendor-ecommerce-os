'use client';

import {
  errorMessage,
  useCancelPayoutMutation,
  useRequestPayoutMutation,
  useSavePayoutAccountMutation,
  useSellerEarningsQuery,
  useSellerLedgerQuery,
  useSellerPayoutsQuery,
} from '@marketbd/api-client';
import { fromPoisha, PayoutAccountSchema, type PayoutAccountInput, type PayoutView, toPoisha } from '@marketbd/shared';
import { Banknote, Building2, CircleDollarSign, Clock, Hourglass, Landmark, Pencil, Smartphone, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, cn, EmptyState, ErrorState, fmtDate, issuesToErrors, Modal, PageHeader, Pager, Skeleton, StatCard, Table, useI18n } from '@marketbd/ui';

const METHOD_LABEL = { BKASH: 'bKash', NAGAD: 'Nagad', BANK: 'Bank transfer' } as const;
const METHOD_ICON = { BKASH: Smartphone, NAGAD: Smartphone, BANK: Landmark } as const;
const STATUS_TONE = { REQUESTED: 'warning', PAID: 'success', REJECTED: 'danger' } as const;

const masked = (n: string) => (n.length > 4 ? `•••• ${n.slice(-4)}` : n);

function AccountForm({ initial, onDone }: { initial: PayoutAccountInput | null; onDone: () => void }) {
  const [save, state] = useSavePayoutAccountMutation();
  const [form, setForm] = useState<PayoutAccountInput>(initial ?? { method: 'BKASH', accountName: '', accountNumber: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<PayoutAccountInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    const parsed = PayoutAccountSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    try {
      await save(form).unwrap();
      toast.success('Payout account saved');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payout method">
        {(['BKASH', 'NAGAD', 'BANK'] as const).map((m) => {
          const Icon = METHOD_ICON[m];
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={form.method === m}
              onClick={() => set({ method: m })}
              className={cn('flex flex-col items-center gap-1 rounded-lg border p-3 text-sm', form.method === m ? 'border-primary-700 bg-primary-50 font-semibold text-primary-800' : 'border-ink-200 hover:border-ink-400')}
            >
              <Icon className="size-5" /> {METHOD_LABEL[m]}
            </button>
          );
        })}
      </div>
      <label className="block">
        <span className="label">Account holder name</span>
        <input className="input" value={form.accountName} onChange={(e) => set({ accountName: e.target.value })} />
        {errors.accountName && <span className="mt-1 block text-xs text-danger">{errors.accountName}</span>}
      </label>
      <label className="block">
        <span className="label">{form.method === 'BANK' ? 'Account number' : `${METHOD_LABEL[form.method]} number (personal / merchant)`}</span>
        <input className="input" inputMode="numeric" value={form.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} placeholder={form.method === 'BANK' ? '' : '01XXXXXXXXX'} />
        {errors.accountNumber && <span className="mt-1 block text-xs text-danger">{errors.accountNumber}</span>}
      </label>
      {form.method === 'BANK' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Bank name</span>
            <input className="input" value={form.bankName ?? ''} onChange={(e) => set({ bankName: e.target.value })} />
            {errors.bankName && <span className="mt-1 block text-xs text-danger">{errors.bankName}</span>}
          </label>
          <label className="block">
            <span className="label">Branch (optional)</span>
            <input className="input" value={form.branch ?? ''} onChange={(e) => set({ branch: e.target.value })} />
          </label>
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={() => void submit()} loading={state.isLoading}>
          Save account
        </Button>
      </div>
    </div>
  );
}

function WithdrawForm({ available, min, onDone }: { available: number; min: number; onDone: () => void }) {
  const { money } = useI18n();
  const [request, state] = useRequestPayoutMutation();
  const [amount, setAmount] = useState(String(fromPoisha(available)));
  const [note, setNote] = useState('');
  const poisha = toPoisha(Number(amount) || 0);
  const error = poisha < min ? `The minimum payout is ${money(min)}` : poisha > available ? `You can withdraw up to ${money(available)}` : null;

  const submit = async () => {
    try {
      await request({ amount: poisha, note: note.trim() || undefined }).unwrap();
      toast.success('Payout requested — admin will send it soon');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-primary-50 p-3 text-sm text-primary-800">
        Available to withdraw: <strong>{money(available)}</strong>
      </p>
      <label className="block">
        <span className="label">Amount (৳)</span>
        <input className="input text-lg font-semibold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Payout amount" />
        {amount && error && <span className="mt-1 block text-xs text-danger">{error}</span>}
      </label>
      <label className="block">
        <span className="label">Note for admin (optional)</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex justify-end">
        <Button onClick={() => void submit()} loading={state.isLoading} disabled={Boolean(error)}>
          Request payout
        </Button>
      </div>
    </div>
  );
}

function PayoutRow({ p }: { p: PayoutView }) {
  const { money } = useI18n();
  const [cancel, state] = useCancelPayoutMutation();
  return (
    <tr>
      <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(p.createdAt)}</td>
      <td className="px-4 py-3 font-semibold">{money(p.amount)}</td>
      <td className="px-4 py-3 text-xs">
        {METHOD_LABEL[p.method]}
        <br />
        <span className="text-ink-500">{masked(p.accountNumber)}</span>
      </td>
      <td className="px-4 py-3">
        <Badge tone={STATUS_TONE[p.status]}>{p.status === 'REQUESTED' ? 'Waiting' : p.status === 'PAID' ? 'Paid' : 'Rejected'}</Badge>
      </td>
      <td className="px-4 py-3 text-xs text-ink-600">
        {p.reference && <p>Ref: {p.reference}</p>}
        {p.adminNote && <p>{p.adminNote}</p>}
        {p.processedAt && <p className="text-ink-400">{fmtDate(p.processedAt)}</p>}
      </td>
      <td className="px-4 py-3 text-right">
        {p.status === 'REQUESTED' && (
          <Button size="sm" variant="ghost" loading={state.isLoading} onClick={() => void cancel(p.id).unwrap().catch((e: unknown) => toast.error(errorMessage(e)))}>
            Cancel
          </Button>
        )}
      </td>
    </tr>
  );
}

/** Seller Center → Earnings: balance, payout account, payout requests and per-order ledger. */
export default function SellerEarningsPage() {
  const { money } = useI18n();
  const { data: e, isLoading, isError, error, refetch } = useSellerEarningsQuery();
  const [tab, setTab] = useState<'payouts' | 'ledger'>('payouts');
  const [page, setPage] = useState(1);
  const payouts = useSellerPayoutsQuery({ page, limit: 10 }, { skip: tab !== 'payouts' });
  const ledger = useSellerLedgerQuery({ page, limit: 15 }, { skip: tab !== 'ledger' });
  const [modal, setModal] = useState<'account' | 'withdraw' | null>(null);

  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (isLoading || !e) return <Skeleton className="h-96" />;
  const waiting = e.requested > 0;
  const canWithdraw = Boolean(e.payoutAccount) && e.available >= e.minPayout && !waiting;
  const AccountIcon = e.payoutAccount ? METHOD_ICON[e.payoutAccount.method] : Building2;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Earnings & payouts"
        description={`Earnings are held ${e.holdDays} days after delivery (the return window), then you can withdraw them.`}
        actions={
          <Button onClick={() => setModal(e.payoutAccount ? 'withdraw' : 'account')} disabled={Boolean(e.payoutAccount) && !canWithdraw}>
            <Banknote className="size-4" /> {e.payoutAccount ? 'Withdraw' : 'Add payout account'}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available to withdraw" value={money(e.available)} icon={Wallet} />
        <StatCard label="On hold (return window)" value={money(e.onHold)} icon={Hourglass} tone="warning" />
        <StatCard label="Payout requested" value={money(e.requested)} icon={Clock} tone="info" />
        <StatCard label="Paid out (all time)" value={money(e.paidOut)} icon={CircleDollarSign} tone="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card p-4">
          <h3 className="mb-3 font-semibold">How your balance is worked out</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-600">Delivered sales</dt>
              <dd className="font-medium">{money(e.gross)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Marketplace commission</dt>
              <dd className="font-medium text-danger">−{money(e.commission)}</dd>
            </div>
            <div className="flex justify-between border-t border-dashed border-ink-200 pt-2">
              <dt className="font-semibold">Your earnings</dt>
              <dd className="font-semibold">{money(e.net)}</dd>
            </div>
            <div className="flex justify-between text-ink-500">
              <dt>Still on hold</dt>
              <dd>−{money(e.onHold)}</dd>
            </div>
            <div className="flex justify-between text-ink-500">
              <dt>Requested / paid out</dt>
              <dd>−{money(e.requested + e.paidOut)}</dd>
            </div>
            <div className="flex justify-between border-t border-dashed border-ink-200 pt-2 text-base">
              <dt className="font-bold">Available</dt>
              <dd className="font-bold text-primary-700">{money(e.available)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-500">Counter (POS) sales are paid to you in cash, so only their commission is taken from this balance.</p>
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Payout account</h3>
            {e.payoutAccount && (
              <button type="button" onClick={() => setModal('account')} className="inline-flex items-center gap-1 text-xs font-medium text-primary-700">
                <Pencil className="size-3.5" /> Change
              </button>
            )}
          </div>
          {e.payoutAccount ? (
            <div className="flex items-start gap-3 rounded-lg bg-ink-50 p-3 text-sm">
              <AccountIcon className="mt-0.5 size-5 text-primary-700" />
              <div>
                <p className="font-semibold">{METHOD_LABEL[e.payoutAccount.method]}</p>
                <p>{e.payoutAccount.accountName}</p>
                <p className="text-ink-500">{e.payoutAccount.accountNumber}</p>
                {e.payoutAccount.bankName && (
                  <p className="text-ink-500">
                    {e.payoutAccount.bankName}
                    {e.payoutAccount.branch ? `, ${e.payoutAccount.branch}` : ''}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-ink-200 p-4 text-center text-sm text-ink-500">
              <p>Add your bKash, Nagad or bank account to receive payouts.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setModal('account')}>
                Add account
              </Button>
            </div>
          )}
          <p className="mt-3 text-xs text-ink-500">
            {waiting
              ? 'You have a payout request waiting. You can request again after it is processed.'
              : e.available < e.minPayout
                ? `You can withdraw once at least ${money(e.minPayout)} is available.`
                : 'Payouts are usually sent within 2 working days.'}
          </p>
        </section>
      </div>

      <section className="card">
        <div className="flex gap-1 border-b border-ink-100 px-3" role="tablist">
          {(
            [
              ['payouts', 'Payout history'],
              ['ledger', 'Earnings by order'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => {
                setTab(k);
                setPage(1);
              }}
              className={cn('-mb-px border-b-2 px-3 py-3 text-sm', tab === k ? 'border-primary-700 font-semibold text-primary-700' : 'border-transparent text-ink-500 hover:text-ink-800')}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'payouts' ? (
          payouts.isLoading ? (
            <Skeleton className="m-4 h-32" />
          ) : (
            <>
              <Table head={['Requested', 'Amount', 'To', 'Status', 'Details', '']} empty={!payouts.data?.items.length ? <EmptyState icon={<Wallet />} title="No payouts yet" text="Your payout requests will show here." /> : null}>
                {payouts.data?.items.map((p) => <PayoutRow key={p.id} p={p} />)}
              </Table>
              {payouts.data && <Pager page={page} totalPages={payouts.data.meta.totalPages} onPage={setPage} />}
            </>
          )
        ) : ledger.isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <>
            <Table head={['Order', 'Delivered', 'Sale', 'Commission', 'You earn', 'Status']} empty={!ledger.data?.items.length ? <EmptyState icon={<CircleDollarSign />} title="No delivered orders yet" /> : null}>
              {ledger.data?.items.map((r) => (
                <tr key={r.subOrderId}>
                  <td className="px-4 py-3">
                    <Link href={`/orders/${r.subOrderId}`} className="font-medium text-primary-700">
                      {r.orderNumber}
                    </Link>
                    {r.channel === 'POS' && <span className="ml-2 rounded bg-accent-50 px-1.5 py-0.5 text-[10px] font-bold text-accent-700">POS</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500">{r.deliveredAt ? fmtDate(r.deliveredAt) : '—'}</td>
                  <td className="px-4 py-3">{money(r.total)}</td>
                  <td className="px-4 py-3 text-xs text-ink-600">
                    −{money(r.commissionAmount)} <span className="text-ink-400">({r.commissionRate}%)</span>
                  </td>
                  <td className={cn('px-4 py-3 font-semibold', r.net < 0 && 'text-danger')}>{r.net < 0 ? `−${money(-r.net)}` : money(r.net)}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.state === 'AVAILABLE' ? (
                      <Badge tone="success">Available</Badge>
                    ) : (
                      <>
                        <Badge tone="warning">On hold</Badge>
                        <p className="mt-1 text-ink-500">{r.availableOn ? `until ${fmtDate(r.availableOn)}` : 'return open'}</p>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
            {ledger.data && <Pager page={page} totalPages={ledger.data.meta.totalPages} onPage={setPage} />}
          </>
        )}
      </section>

      <Modal open={modal === 'account'} onClose={() => setModal(null)} title="Payout account">
        <AccountForm initial={e.payoutAccount} onDone={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'withdraw'} onClose={() => setModal(null)} title="Withdraw earnings">
        <WithdrawForm available={e.available} min={e.minPayout} onDone={() => setModal(null)} />
      </Modal>
    </div>
  );
}
