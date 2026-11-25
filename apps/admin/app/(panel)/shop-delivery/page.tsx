'use client';

import {
  errorMessage,
  useAdminAddAdjustmentMutation,
  useAdminDecideOwnDeliveryMutation,
  useAdminDeliveryDisputesQuery,
  useAdminOwnDeliveryQuery,
  useAdminSellerAdjustmentsQuery,
  useUpdateSettingsMutation,
} from '@marketbd/api-client';
import { fromPoisha, ownCourierName, type OwnDeliveryShopView, toPoisha } from '@marketbd/shared';
import { AlertTriangle, Bike } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, cn, EmptyState, fmtDate, Modal, PageHeader, Skeleton, Table, useI18n } from '@marketbd/ui';

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'disputes';
const TABS: Array<[Tab, string]> = [
  ['PENDING', 'Requests'],
  ['APPROVED', 'Shops delivering'],
  ['REJECTED', 'Rejected'],
  ['disputes', 'Delivery complaints'],
];

function DecideModal({ shop, action, onClose }: { shop: OwnDeliveryShopView; action: 'REJECT' | 'DISABLE'; onClose: () => void }) {
  const [decide, state] = useAdminDecideOwnDeliveryMutation();
  const [note, setNote] = useState('');
  const submit = async () => {
    try {
      await decide({ sellerId: shop.seller.id, action, note: note.trim() }).unwrap();
      toast.success(action === 'REJECT' ? 'Request rejected' : 'Switched back to MarketBD Delivery');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Modal open onClose={onClose} title={action === 'REJECT' ? `Reject ${shop.seller.shopName}` : `Stop own delivery for ${shop.seller.shopName}`}>
      <div className="space-y-3">
        <label className="block">
          <span className="label">Reason (shown to the seller)</span>
          <textarea className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="danger" loading={state.isLoading} disabled={!note.trim()} onClick={() => void submit()}>
            {action === 'REJECT' ? 'Reject' : 'Stop own delivery'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PaymentModal({ shop, onClose }: { shop: OwnDeliveryShopView; onClose: () => void }) {
  const { money } = useI18n();
  const [add, state] = useAdminAddAdjustmentMutation();
  const { data: history = [] } = useAdminSellerAdjustmentsQuery(shop.seller.id);
  const [amount, setAmount] = useState(shop.balance < 0 ? String(fromPoisha(-shop.balance)) : '');
  const [note, setNote] = useState('Commission paid by the shop');
  const [reference, setReference] = useState('');
  const submit = async () => {
    try {
      await add({ sellerId: shop.seller.id, amount: toPoisha(Number(amount) || 0), note, reference: reference.trim() || undefined }).unwrap();
      toast.success('Payment recorded');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Modal open onClose={onClose} title={`Payment from ${shop.seller.shopName}`}>
      <div className="space-y-3">
        <p className="rounded-md bg-ink-50 p-3 text-sm">
          Current balance: <b className={shop.balance < 0 ? 'text-danger' : ''}>{shop.balance < 0 ? `owes ${money(-shop.balance)}` : money(shop.balance)}</b>
        </p>
        <label className="block">
          <span className="label">Amount received (৳)</span>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.-]/g, ''))} />
          <span className="mt-1 block text-xs text-ink-400">Use a minus amount to correct a mistake.</span>
        </label>
        <label className="block">
          <span className="label">Note</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">bKash / bank reference (optional)</span>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button loading={state.isLoading} disabled={!Number(amount)} onClick={() => void submit()}>
            Record payment
          </Button>
        </div>
        {history.length > 0 && (
          <div className="border-t border-ink-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Earlier</p>
            <ul className="space-y-1 text-sm">
              {history.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span className="text-ink-600">
                    {fmtDate(a.createdAt)} · {a.note}
                    {a.reference ? ` (${a.reference})` : ''}
                  </span>
                  <span className={a.amount < 0 ? 'text-danger' : 'font-medium'}>{a.amount < 0 ? `−${money(-a.amount)}` : money(a.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DueLimit({ current }: { current: number }) {
  const [update, state] = useUpdateSettingsMutation();
  const [value, setValue] = useState(String(fromPoisha(current)));
  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      <label className="block">
        <span className="label">Pause COD when a shop owes more than (৳)</span>
        <input className="input w-48" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} />
      </label>
      <Button
        variant="outline"
        loading={state.isLoading}
        onClick={() =>
          void update({ ownDeliveryDueLimit: toPoisha(Number(value) || 0) })
            .unwrap()
            .then(() => toast.success('Limit saved'))
            .catch((e: unknown) => toast.error(errorMessage(e)))
        }
      >
        Save limit
      </Button>
      <p className="max-w-md text-xs text-ink-500">Shops delivering with their own courier collect COD cash themselves and owe the commission. Above this amount, COD is paused for their items until they pay.</p>
    </div>
  );
}

/** Admin → Shop delivery: approve shops' own couriers, track dues, delivery performance and complaints. */
export default function ShopDeliveryPage() {
  const { money } = useI18n();
  const [tab, setTab] = useState<Tab>('PENDING');
  const shops = useAdminOwnDeliveryQuery({ status: tab === 'disputes' ? undefined : tab }, { skip: tab === 'disputes' });
  const all = useAdminOwnDeliveryQuery({});
  const disputes = useAdminDeliveryDisputesQuery();
  const [decide, decideState] = useAdminDecideOwnDeliveryMutation();
  const [modal, setModal] = useState<{ kind: 'REJECT' | 'DISABLE' | 'PAY'; shop: OwnDeliveryShopView } | null>(null);
  const pendingCount = all.data?.filter((s) => s.status === 'PENDING').length ?? 0;

  const approve = async (shop: OwnDeliveryShopView) => {
    try {
      await decide({ sellerId: shop.seller.id, action: 'APPROVE' }).unwrap();
      toast.success(`${shop.seller.shopName} now delivers with its own courier`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Shop delivery" description="Shops that deliver with their own courier: approve requests, follow their dues and delivery performance, and settle delivery complaints." />
      {all.data?.[0] && <DueLimit key={all.data[0].dueLimit} current={all.data[0].dueLimit} />}

      <div className="card">
        <div className="flex gap-1 overflow-x-auto border-b border-ink-100 px-3" role="tablist">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm', tab === k ? 'border-primary-700 font-semibold text-primary-700' : 'border-transparent text-ink-500 hover:text-ink-800')}
            >
              {label}
              {k === 'PENDING' && pendingCount > 0 && <Badge tone="warning">{pendingCount}</Badge>}
              {k === 'disputes' && (disputes.data?.length ?? 0) > 0 && <Badge tone="danger">{disputes.data?.length}</Badge>}
            </button>
          ))}
        </div>

        {tab === 'disputes' ? (
          disputes.isLoading ? (
            <Skeleton className="m-4 h-32" />
          ) : (
            <Table head={['Order', 'Shop / courier', 'Customer', 'Complaint', 'Since']} empty={!disputes.data?.length ? <EmptyState icon={<AlertTriangle />} title="No open complaints" /> : null}>
              {disputes.data?.map((d) => (
                <tr key={d.subOrderId}>
                  <td className="px-4 py-3">
                    <Link href={`/orders/${d.orderId}`} className="font-medium text-primary-700">
                      {d.orderNumber}
                    </Link>
                    <p className="text-xs text-ink-500">{money(d.total)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {d.shopName}
                    <br />
                    <span className="text-ink-500">
                      {d.courierName ?? 'MarketBD Delivery'}
                      {d.trackingNumber ? ` · ${d.trackingNumber}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {d.customer.name}
                    <br />
                    <span className="text-ink-500">{d.customer.phone}</span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs">{d.note}</td>
                  <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(d.createdAt)}</td>
                </tr>
              ))}
            </Table>
          )
        ) : shops.isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table
            head={['Shop', 'Courier & fees', tab === 'APPROVED' ? 'Delivery performance' : 'Requested', 'Balance', '']}
            empty={!shops.data?.length ? <EmptyState icon={<Bike />} title={tab === 'PENDING' ? 'No requests waiting' : 'Nothing here'} /> : null}
          >
            {shops.data?.map((s) => (
              <tr key={s.seller.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{s.seller.shopName}</p>
                  <p className="text-xs text-ink-500">{s.seller.phone}</p>
                  {s.note && <p className="mt-1 text-xs text-danger">Note: {s.note}</p>}
                </td>
                <td className="px-4 py-3 text-xs">
                  {s.settings ? (
                    <>
                      <p className="font-semibold">{ownCourierName(s.settings)}</p>
                      <p className="text-ink-600">
                        Dhaka {money(s.settings.insideDhakaFee)} · {s.settings.insideDhakaEta}
                      </p>
                      <p className="text-ink-600">
                        Outside {money(s.settings.outsideDhakaFee)} · {s.settings.outsideDhakaEta}
                      </p>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-600">
                  {tab === 'APPROVED' ? (
                    <>
                      <p>
                        {s.stats.delivered}/{s.stats.shipped} delivered
                        {s.stats.avgDeliveryDays !== null ? ` · avg ${s.stats.avgDeliveryDays} days` : ''}
                      </p>
                      <p>
                        {s.stats.returned} returned · {s.stats.disputes} complaints
                        {s.stats.openDisputes ? <span className="font-semibold text-danger"> ({s.stats.openDisputes} open)</span> : null}
                      </p>
                    </>
                  ) : (
                    (s.updatedAt && fmtDate(s.updatedAt)) || '—'
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className={cn('font-semibold', s.balance < 0 && 'text-danger')}>{s.balance < 0 ? `owes ${money(-s.balance)}` : money(s.balance)}</span>
                  {s.codPaused && (
                    <p className="mt-1">
                      <Badge tone="danger">COD paused</Badge>
                    </p>
                  )}
                </td>
                <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right">
                  {s.status === 'PENDING' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'REJECT', shop: s })}>
                        Reject
                      </Button>
                      <Button size="sm" loading={decideState.isLoading} onClick={() => void approve(s)}>
                        Approve
                      </Button>
                    </>
                  )}
                  {s.status === 'APPROVED' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setModal({ kind: 'PAY', shop: s })}>
                        Record payment
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'DISABLE', shop: s })}>
                        Stop
                      </Button>
                    </>
                  )}
                  {s.status === 'REJECTED' && (
                    <Button size="sm" variant="outline" loading={decideState.isLoading} onClick={() => void approve(s)}>
                      Approve anyway
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {modal?.kind === 'PAY' && <PaymentModal shop={modal.shop} onClose={() => setModal(null)} />}
      {(modal?.kind === 'REJECT' || modal?.kind === 'DISABLE') && <DecideModal shop={modal.shop} action={modal.kind} onClose={() => setModal(null)} />}
    </div>
  );
}
