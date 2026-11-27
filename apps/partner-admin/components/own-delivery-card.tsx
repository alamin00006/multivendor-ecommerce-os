'use client';

import { errorMessage, useOwnDeliveryQuery, useSaveOwnDeliveryMutation, useStopOwnDeliveryMutation } from '@marketbd/api-client';
import { fromPoisha, OWN_COURIER_LABEL, OWN_COURIERS, type OwnCourier, ownCourierName, OwnDeliverySchema, toPoisha } from '@marketbd/shared';
import { AlertTriangle, Bike, Clock, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, cn, issuesToErrors, OwnCourierAccountsManager, Skeleton, useI18n } from '@marketbd/ui';

interface Draft {
  courier: OwnCourier;
  courierName: string;
  insideDhakaFee: string;
  outsideDhakaFee: string;
  insideDhakaEta: string;
  outsideDhakaEta: string;
}

const STATUS = {
  PENDING: { tone: 'warning', label: 'Waiting for MarketBD approval' },
  APPROVED: { tone: 'success', label: 'Approved — in use' },
  REJECTED: { tone: 'danger', label: 'Not approved' },
} as const;

/** Seller Center → Courier: choose MarketBD Delivery or the shop's own courier. */
export function OwnDeliveryCard() {
  const { money } = useI18n();
  const { data, isLoading } = useOwnDeliveryQuery();
  const [save, saveState] = useSaveOwnDeliveryMutation();
  const [stop, stopState] = useStopOwnDeliveryMutation();
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft | null>(null);

  if (isLoading || !data) return <Skeleton className="h-40" />;
  const own = data.status !== null;
  const s = data.settings;

  const startEdit = () => {
    setDraft({
      courier: s?.courier ?? 'STEADFAST',
      courierName: s?.courierName ?? '',
      insideDhakaFee: String(fromPoisha(s?.insideDhakaFee ?? 6000)),
      outsideDhakaFee: String(fromPoisha(s?.outsideDhakaFee ?? 12000)),
      insideDhakaEta: s?.insideDhakaEta ?? '1–2 days',
      outsideDhakaEta: s?.outsideDhakaEta ?? '3–5 days',
    });
    setErrors({});
    setEditing(true);
  };

  const submit = async () => {
    if (!draft) return;
    const body = {
      courier: draft.courier,
      courierName: draft.courierName.trim() || undefined,
      insideDhakaFee: toPoisha(Number(draft.insideDhakaFee) || 0),
      outsideDhakaFee: toPoisha(Number(draft.outsideDhakaFee) || 0),
      insideDhakaEta: draft.insideDhakaEta,
      outsideDhakaEta: draft.outsideDhakaEta,
    };
    const parsed = OwnDeliverySchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    try {
      await save(body).unwrap();
      toast.success('Sent to MarketBD for approval');
      setEditing(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const backToPlatform = async () => {
    if (!confirm('Use MarketBD Delivery for new orders? Orders already placed keep their current courier.')) return;
    try {
      await stop().unwrap();
      toast.success('New orders now use MarketBD Delivery');
      setEditing(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const option = (on: boolean, icon: React.ReactNode, title: string, text: string, onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn('flex flex-1 items-start gap-3 rounded-lg border p-3 text-left', on ? 'border-primary-700 bg-primary-50' : 'border-ink-200 hover:border-ink-400')}
    >
      <span className={cn('mt-0.5 rounded-md p-2', on ? 'bg-primary-700 text-white' : 'bg-ink-100 text-ink-600')}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-ink-900">{title}</span>
        <span className="text-xs text-ink-600">{text}</span>
      </span>
    </button>
  );

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">Delivery method</h2>
        <p className="text-sm text-ink-600">Who delivers your orders to customers.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {option(!own, <Truck className="size-5" />, 'MarketBD Delivery', 'Book MarketBD’s couriers from your orders. Delivery fees are set by MarketBD and COD cash is collected by MarketBD.', own ? () => void backToPlatform() : undefined)}
        {option(own, <Bike className="size-5" />, 'My own courier', 'Ship with your own courier account or riders, at your own fees. You collect COD cash and pay MarketBD its commission.', !own && !editing ? startEdit : undefined)}
      </div>

      {own && !editing && s && (
        <div className="space-y-3 rounded-lg border border-ink-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{ownCourierName(s)}</p>
            {data.status && <Badge tone={STATUS[data.status].tone}>{STATUS[data.status].label}</Badge>}
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-md bg-ink-50 p-2.5">
              <dt className="text-xs text-ink-500">Inside Dhaka</dt>
              <dd className="font-medium">
                {money(s.insideDhakaFee)} · {s.insideDhakaEta}
              </dd>
            </div>
            <div className="rounded-md bg-ink-50 p-2.5">
              <dt className="text-xs text-ink-500">Outside Dhaka</dt>
              <dd className="font-medium">
                {money(s.outsideDhakaFee)} · {s.outsideDhakaEta}
              </dd>
            </div>
          </dl>
          {data.note && <p className="text-sm text-danger">MarketBD: {data.note}</p>}
          {data.status === 'PENDING' && (
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Clock className="size-3.5" /> Until approved, new orders use MarketBD Delivery.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={startEdit}>
              Change courier or fees
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void backToPlatform()} loading={stopState.isLoading}>
              Use MarketBD Delivery
            </Button>
          </div>
          <p className="text-xs text-ink-400">Changes are checked by MarketBD again before they are used.</p>
        </div>
      )}

      {data.status === 'APPROVED' && (
        <div className={cn('flex items-start gap-2 rounded-lg p-3 text-sm', data.codPaused ? 'bg-red-50 text-red-800' : 'bg-ink-50 text-ink-700')}>
          {data.codPaused && <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
          <p>
            {data.balance < 0 ? (
              <>
                You owe MarketBD <b>{money(-data.balance)}</b> in commission on cash orders.{' '}
                {data.codPaused ? 'Cash on Delivery is paused for your items until you pay.' : `COD is paused if this goes over ${money(data.dueLimit)}.`}{' '}
                <Link href="/earnings" className="font-medium underline">
                  See earnings
                </Link>
              </>
            ) : (
              <>Cash you collect on delivery is yours; MarketBD’s commission is taken from your balance. COD pauses if you owe more than {money(data.dueLimit)}.</>
            )}
          </p>
        </div>
      )}

      {editing && draft && (
        <div className="space-y-4 rounded-lg border border-ink-100 p-4">
          <label className="block">
            <span className="label">Courier</span>
            <select className="input" value={draft.courier} onChange={(e) => setDraft({ ...draft, courier: e.target.value as OwnCourier })}>
              {OWN_COURIERS.map((c) => (
                <option key={c} value={c}>
                  {OWN_COURIER_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          {draft.courier === 'OTHER' && (
            <label className="block">
              <span className="label">Courier name</span>
              <input className="input" value={draft.courierName} onChange={(e) => setDraft({ ...draft, courierName: e.target.value })} />
              {errors.courierName && <span className="mt-1 block text-xs text-danger">{errors.courierName}</span>}
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['insideDhakaFee', 'Fee inside Dhaka (৳)', 'insideDhakaEta', 'Time inside Dhaka'],
                ['outsideDhakaFee', 'Fee outside Dhaka (৳)', 'outsideDhakaEta', 'Time outside Dhaka'],
              ] as const
            ).map(([fee, feeLabel, eta, etaLabel]) => (
              <div key={fee} className="space-y-3">
                <label className="block">
                  <span className="label">{feeLabel}</span>
                  <input className="input" inputMode="decimal" value={draft[fee]} onChange={(e) => setDraft({ ...draft, [fee]: e.target.value.replace(/[^\d.]/g, '') })} />
                  {errors[fee] && <span className="mt-1 block text-xs text-danger">{errors[fee]}</span>}
                </label>
                <label className="block">
                  <span className="label">{etaLabel}</span>
                  <input className="input" placeholder="e.g. 1–2 days" value={draft[eta]} onChange={(e) => setDraft({ ...draft, [eta]: e.target.value })} />
                  {errors[eta] && <span className="mt-1 block text-xs text-danger">{errors[eta]}</span>}
                </label>
              </div>
            ))}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-ink-600">
            <li>Customers see your fee and delivery time at checkout.</li>
            <li>When you mark a package shipped, enter the courier’s tracking number.</li>
            <li>Cash on Delivery money is collected by your courier for you; MarketBD’s commission is taken from your balance.</li>
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={saveState.isLoading}>
              Send for approval
            </Button>
          </div>
        </div>
      )}
      {own && !editing && (
        <div className="space-y-3 border-t border-ink-100 pt-4">
          <div>
            <h3 className="font-semibold">Connect your courier account (optional)</h3>
            <p className="text-sm text-ink-600">
              Add your own Steadfast or Pathao API keys to book parcels from each order on your account. Paste the webhook into the courier’s panel and orders move to
              shipped and delivered by themselves. Without it, book with your courier yourself and enter the tracking number.
            </p>
          </div>
          <OwnCourierAccountsManager />
        </div>
      )}
    </section>
  );
}
