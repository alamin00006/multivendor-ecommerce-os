'use client';

import {
  type CourierScope,
  errorMessage,
  useBookShipmentMutation,
  useCourierAccountsQuery,
  useCourierAreasQuery,
  useCourierCitiesQuery,
  useCourierOptionsQuery,
  useCourierZonesQuery,
  useOwnCourierAccountsQuery,
  useOwnCourierOptionsQuery,
  useRotateCourierWebhookSecretMutation,
  useRotateOwnCourierWebhookSecretMutation,
  useSaveOwnCourierAccountMutation,
  useSaveCourierAccountMutation,
  useSaveCourierStoreMutation,
  useSyncShipmentMutation,
  useTestCourierAccountMutation,
  useTestOwnCourierAccountMutation,
} from '@marketbd/api-client';
import {
  COURIER_CATALOG,
  type CourierAccountView,
  type CourierOption,
  type CourierProvider,
  CourierStoreSchema,
  type OrderStatus,
  type SellerCourierAccountView,
  type ShipmentView,
} from '@marketbd/shared';
import { Copy, PlugZap, RefreshCw, Truck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '../i18n';
import { Badge, Button, EmptyState, Skeleton } from '../primitives';

const fmtStatus = (s: string) => s.replace(/^order\./, '').replace(/[-_]+/g, ' ');

const copy = (text: string) => {
  void navigator.clipboard.writeText(text).then(() => toast.success('Copied'));
};

// ───── Admin → Couriers ─────

/**
 * One courier account. `own` = the shop's own account (own delivery): saved under the seller, with
 * the shop's own webhook URL and, for couriers with stores, the shop's store id at the courier.
 */
function CourierAccountCard({ account, own = false }: { account: CourierAccountView | SellerCourierAccountView; own?: boolean }) {
  const entry = COURIER_CATALOG[account.provider];
  const [saveAdmin, savingAdmin] = useSaveCourierAccountMutation();
  const [testAdmin, testingAdmin] = useTestCourierAccountMutation();
  const [rotateAdmin, rotatingAdmin] = useRotateCourierWebhookSecretMutation();
  const [saveOwn, savingOwn] = useSaveOwnCourierAccountMutation();
  const [testOwn, testingOwn] = useTestOwnCourierAccountMutation();
  const [rotateOwn, rotatingOwn] = useRotateOwnCourierWebhookSecretMutation();
  const saving = own ? savingOwn : savingAdmin;
  const testing = own ? testingOwn : testingAdmin;
  const rotating = own ? rotatingOwn : rotatingAdmin;
  const [storeId, setStoreId] = useState('storeExternalId' in account ? (account.storeExternalId ?? '') : '');
  const [enabled, setEnabled] = useState(account.enabled);
  const [sandbox, setSandbox] = useState(account.sandbox);
  const [creds, setCreds] = useState<Record<string, string>>(() =>
    Object.fromEntries(entry.fields.map((f) => [f.key, f.secret ? '' : (account.credentials[f.key] ?? '')])),
  );

  const submit = async () => {
    try {
      if (own) await saveOwn({ provider: account.provider, body: { enabled, sandbox, credentials: creds, storeExternalId: storeId.trim() } }).unwrap();
      else await saveAdmin({ provider: account.provider, body: { enabled, sandbox, credentials: creds } }).unwrap();
      setCreds((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, entry.fields.find((f) => f.key === k)?.secret ? '' : v])));
      toast.success(`${entry.name} saved`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const onTest = async () => {
    try {
      toast.success((await (own ? testOwn : testAdmin)(account.provider).unwrap()).message);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const onRotate = async () => {
    if (!confirm(`Create a new webhook secret for ${entry.name}? The old one stops working until you update it in the ${entry.name} panel.`)) return;
    try {
      await (own ? rotateOwn : rotateAdmin)(account.provider).unwrap();
      toast.success('New webhook secret created');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><Truck className="size-5" /> {entry.name}</h3>
        <div className="flex items-center gap-2">
          {entry.supportsStores && !own && <Badge tone="info">Pickup from each seller</Badge>}
          <Badge tone={account.enabled ? 'success' : 'neutral'}>{account.enabled ? 'Enabled' : 'Off'}</Badge>
        </div>
      </div>
      {entry.note && !own && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">{entry.note}</p>}

      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> {own ? 'Use for my own deliveries' : 'Enabled for booking'}
        </label>
        {entry.hasSandbox && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} /> Sandbox (test) environment
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entry.fields.map((f) => {
          const saved = account.configured.includes(f.key);
          return (
            <div key={f.key}>
              <label className="label" htmlFor={`${account.provider}-${f.key}`}>{f.label}</label>
              <input
                id={`${account.provider}-${f.key}`}
                className="input"
                type={f.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={f.secret && saved ? 'Saved. Leave blank to keep it' : ''}
                value={creds[f.key] ?? ''}
                onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })}
              />
              {f.help && <p className="mt-1 text-xs text-ink-500">{f.help}</p>}
            </div>
          );
        })}
        {own && entry.supportsStores && (
          <div>
            <label className="label" htmlFor={`${account.provider}-store`}>Store ID</label>
            <input id={`${account.provider}-store`} className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)} />
            <p className="mt-1 text-xs text-ink-500">{entry.name} merchant panel → Stores → the store your parcels are picked up from.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button loading={saving.isLoading} onClick={() => void submit()}>Save</Button>
        <Button variant="outline" loading={testing.isLoading} disabled={account.configured.length === 0} onClick={() => void onTest()}>
          <PlugZap className="size-4" /> Test connection
        </Button>
      </div>

      {account.webhookSecret && (
        <div className="space-y-2 rounded-md border border-ink-100 bg-ink-50 p-3 text-sm">
          <p className="font-medium">Webhook (status updates)</p>
          <p className="text-xs text-ink-500">{entry.webhookHelp}</p>
          {[
            ['URL', account.webhookUrl],
            ['Secret', account.webhookSecret],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-ink-500">{label}</span>
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs">{value}</code>
              <button type="button" className="rounded p-1.5 hover:bg-white" aria-label={`Copy ${label}`} onClick={() => copy(value!)}>
                <Copy className="size-4" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" loading={rotating.isLoading} onClick={() => void onRotate()}>New secret</Button>
        </div>
      )}
    </section>
  );
}

/** Every supported courier: enable it, enter its credentials, test them and copy its webhook. */
export function CourierAccountsManager() {
  const { data, isLoading } = useCourierAccountsQuery();
  if (isLoading || !data) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-4">
      {data.map((a) => (
        <CourierAccountCard key={`${a.provider}-${a.updatedAt ?? 'new'}`} account={a} />
      ))}
    </div>
  );
}

/**
 * Seller Center: the shop's own courier accounts (own delivery). Parcels are then booked on the
 * shop's account from each order, and the courier updates their status through the shop's webhook.
 */
export function OwnCourierAccountsManager() {
  const { data, isLoading } = useOwnCourierAccountsQuery();
  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-4">
      {data.map((a) => (
        <CourierAccountCard key={`${a.provider}-${a.updatedAt ?? 'new'}`} account={a} own />
      ))}
    </div>
  );
}

// ───── Pickup stores (seller, or the house store from the admin) ─────

function CourierStoreForm({ scope, option }: { scope: CourierScope; option: CourierOption }) {
  const provider = option.provider;
  const store = option.store;
  const [save, saving] = useSaveCourierStoreMutation();
  const [form, setForm] = useState<{ contactName: string; contactNumber: string; address: string; cityId: number; zoneId: number; areaId: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const v = form ?? {
    contactName: store?.contactName ?? '',
    contactNumber: store?.contactNumber.replace(/^\+88/, '') ?? '',
    address: store?.address ?? '',
    cityId: store?.cityId ?? 0,
    zoneId: store?.zoneId ?? 0,
    areaId: store?.areaId ?? 0,
  };
  const set = (patch: Partial<typeof v>) => setForm({ ...v, ...patch });
  const { data: cities } = useCourierCitiesQuery(provider);
  const { data: zones } = useCourierZonesQuery({ provider, cityId: v.cityId }, { skip: !v.cityId });
  const { data: areas } = useCourierAreasQuery({ provider, zoneId: v.zoneId }, { skip: !v.zoneId });

  const submit = async () => {
    const parsed = CourierStoreSchema.safeParse(v);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    try {
      const res = await save({ scope, provider, body: parsed.data }).unwrap();
      setForm(null);
      const ready = res.find((o) => o.provider === provider)?.ready;
      toast.success(ready ? 'Pickup address saved' : `Sent to ${option.name}. Approval can take about an hour.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const select = (label: string, key: 'cityId' | 'zoneId' | 'areaId', rows: { id: number; name: string }[] | undefined, onPick: (id: number) => void) => (
    <div>
      <label className="label" htmlFor={`${provider}-${key}`}>{label}</label>
      <select id={`${provider}-${key}`} className="input" value={v[key] || ''} onChange={(e) => onPick(Number(e.target.value))} disabled={!rows}>
        <option value="">Select…</option>
        {rows?.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
      {errors[key] && <p className="field-error">Select the {label.toLowerCase()}</p>}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${provider}-contactName`}>Contact name</label>
          <input id={`${provider}-contactName`} className="input" value={v.contactName} onChange={(e) => set({ contactName: e.target.value })} />
          {errors.contactName && <p className="field-error">{errors.contactName}</p>}
        </div>
        <div>
          <label className="label" htmlFor={`${provider}-contactNumber`}>Contact phone</label>
          <input id={`${provider}-contactNumber`} className="input" inputMode="tel" placeholder="01XXXXXXXXX" value={v.contactNumber} onChange={(e) => set({ contactNumber: e.target.value })} />
          {errors.contactNumber && <p className="field-error">{errors.contactNumber}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`${provider}-address`}>Pickup address</label>
          <input id={`${provider}-address`} className="input" value={v.address} onChange={(e) => set({ address: e.target.value })} />
          {errors.address && <p className="field-error">{errors.address}</p>}
        </div>
        {select('City', 'cityId', cities, (id) => set({ cityId: id, zoneId: 0, areaId: 0 }))}
        {select('Zone', 'zoneId', v.cityId ? zones : undefined, (id) => set({ zoneId: id, areaId: 0 }))}
        {select('Area', 'areaId', v.zoneId ? areas : undefined, (id) => set({ areaId: id }))}
      </div>
      {store && <p className="text-xs text-ink-500">Saving a changed address registers a new pickup point with {option.name}; new bookings use it.</p>}
      <Button loading={saving.isLoading} onClick={() => void submit()} disabled={!form}>
        {store ? 'Update pickup address' : 'Save pickup address'}
      </Button>
    </div>
  );
}

/** The enabled couriers and this shop's pickup address at each one that collects from sellers. */
export function CourierSettings({ scope }: { scope: CourierScope }) {
  const { data: options, isLoading } = useCourierOptionsQuery(scope);
  if (isLoading || !options) return <Skeleton className="h-64" />;
  if (options.length === 0) {
    return <EmptyState icon={<Truck />} title="No courier yet" text="The platform admin has not switched on any courier. You can still ship with your own courier and enter its tracking number on the order." />;
  }
  return (
    <div className="space-y-4">
      {options.map((o) => (
        <section key={o.provider} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold"><Truck className="size-4" /> {o.name}</h3>
            <Badge tone={o.ready ? 'success' : 'warning'}>{o.ready ? 'Ready to book' : o.store ? 'Waiting for approval' : 'Pickup address needed'}</Badge>
          </div>
          {o.supportsStores ? (
            <>
              <p className="text-sm text-ink-500">The {o.name} rider collects your parcels from this address.</p>
              <CourierStoreForm key={`${o.provider}-${o.store?.name ?? 'new'}`} scope={scope} option={o} />
            </>
          ) : (
            <p className="text-sm text-ink-600">{o.note ?? `No setup needed. Book ${o.name} from a confirmed order.`}</p>
          )}
        </section>
      ))}
    </div>
  );
}

// ───── Booking panel on an order ─────

const BOOKABLE: readonly OrderStatus[] = ['CONFIRMED', 'PROCESSING'];

/** Courier booking for one package: pick a courier and book, then follow its consignment. */
export function ShipmentPanel({
  scope,
  orderId,
  subOrderId,
  status,
  shipment,
  title = 'Courier',
  own = false,
}: {
  scope: CourierScope;
  orderId: string;
  subOrderId: string;
  status: OrderStatus;
  shipment: ShipmentView | null;
  title?: string;
  /** Own-delivery package: book on the shop's own connected courier accounts. */
  own?: boolean;
}) {
  const { money } = useI18n();
  const { data: platformOptions } = useCourierOptionsQuery(scope, { skip: own });
  const { data: ownOptions } = useOwnCourierOptionsQuery(undefined, { skip: !own });
  const options = own ? ownOptions : platformOptions;
  const [book, booking] = useBookShipmentMutation();
  const [sync, syncing] = useSyncShipmentMutation();
  const [picked, setPicked] = useState<CourierProvider | ''>('');
  const [weight, setWeight] = useState('0.5');
  const [instruction, setInstruction] = useState('');

  // The admin books for any shop: the API checks that shop's pickup store.
  const usable = (options ?? []).filter((o) => scope === 'admin' || o.ready);
  const provider = picked || usable[0]?.provider || '';
  const option = usable.find((o) => o.provider === provider);
  const active = shipment?.active ? shipment : null;
  const canBook = !active && BOOKABLE.includes(status);
  if (!shipment && (options ?? []).length === 0 && !own) return null;

  const onBook = async () => {
    if (!provider) return;
    try {
      await book({ scope, orderId, subOrderId, body: { provider, itemWeight: Number(weight), specialInstruction: instruction || undefined } }).unwrap();
      toast.success(`${COURIER_CATALOG[provider].name} booked`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const onSync = async () => {
    try {
      await sync({ scope, orderId, subOrderId }).unwrap();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section className="card space-y-3 p-4">
      <h3 className="flex items-center gap-2 font-semibold"><Truck className="size-4" /> {title}</h3>
      {shipment && (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-ink-500">Courier</dt><dd>{COURIER_CATALOG[shipment.provider].name}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-500">Tracking</dt><dd className="font-mono">{shipment.trackingCode}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-500">Status</dt><dd className="capitalize">{fmtStatus(shipment.courierStatus)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-500">Cash to collect</dt><dd>{money(shipment.codAmount)}</dd></div>
          {shipment.deliveryFee !== null && <div className="flex justify-between gap-2"><dt className="text-ink-500">Delivery charge</dt><dd>{money(shipment.deliveryFee)}</dd></div>}
          {shipment.collectedAmount !== null && <div className="flex justify-between gap-2"><dt className="text-ink-500">Collected</dt><dd>{money(shipment.collectedAmount)}</dd></div>}
        </dl>
      )}
      {shipment && !shipment.active && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">The courier cancelled this booking. Book again or cancel the order.</p>}
      {active && (
        <Button size="sm" variant="outline" loading={syncing.isLoading} onClick={() => void onSync()}>
          <RefreshCw className="size-4" /> Refresh status
        </Button>
      )}
      {canBook &&
        (usable.length === 0 ? (
          <p className="text-xs text-ink-500">
            {own
              ? 'Connect your Steadfast or Pathao account in Courier settings to book from here, or book with your courier yourself and mark the order shipped with its tracking number.'
              : 'Add your pickup address in Courier settings to book a courier.'}
          </p>
        ) : (
          <div className="space-y-2">
            {usable.length > 1 && (
              <select className="input" value={provider} onChange={(e) => setPicked(e.target.value as CourierProvider)} aria-label="Courier">
                {usable.map((o) => (
                  <option key={o.provider} value={o.provider}>{o.name}</option>
                ))}
              </select>
            )}
            {option?.needsWeight && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-ink-600" htmlFor={`w-${subOrderId}`}>Weight (kg)</label>
                <input id={`w-${subOrderId}`} className="input h-8 w-20" type="number" min={0.5} max={10} step={0.5} value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
            )}
            <input className="input" placeholder="Note for the rider (optional)" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            <Button size="sm" block loading={booking.isLoading} onClick={() => void onBook()}>
              Book {option?.name ?? 'courier'}
            </Button>
          </div>
        ))}
      {!shipment && !canBook && <p className="text-xs text-ink-500">Confirm the order to book a courier.</p>}
    </section>
  );
}
