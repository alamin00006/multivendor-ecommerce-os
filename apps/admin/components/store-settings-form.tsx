'use client';

import { errorMessage, useUpdateSettingsMutation } from '@marketbd/api-client';
import { fromPoisha, type PublicSettings, toPoisha, UpdatePlatformSettingsSchema } from '@marketbd/shared';
import { Button, issuesToErrors } from '@marketbd/ui';
import { MapPin, RotateCcw, Truck } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

const SOCIALS = ['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin'] as const;

function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function Section({ icon, title, children, onSave, saving }: { icon: ReactNode; title: string; children: ReactNode; onSave: () => void; saving: boolean }) {
  return (
    <section className="card space-y-4 p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        {icon} {title}
      </h3>
      {children}
      <div className="flex justify-end">
        <Button onClick={onSave} loading={saving}>
          Save
        </Button>
      </div>
    </section>
  );
}

/** Delivery fees, return policy and store contact info — saved section by section. */
export function StoreSettingsForm({ settings }: { settings: PublicSettings }) {
  const [update, state] = useUpdateSettingsMutation();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [delivery, setDelivery] = useState({
    inside: String(fromPoisha(settings.shipping.insideDhaka)),
    outside: String(fromPoisha(settings.shipping.outsideDhaka)),
    insideEta: settings.shipping.insideDhakaEta,
    outsideEta: settings.shipping.outsideDhakaEta,
  });
  const [returns, setReturns] = useState({ days: String(settings.returns.days), policy: settings.returns.policy });
  const [store, setStore] = useState({ ...settings.store, social: { ...settings.store.social } });

  const save = async (section: string, body: Record<string, unknown>) => {
    const parsed = UpdatePlatformSettingsSchema.safeParse(body);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setSaving(section);
    try {
      await update(body).unwrap();
      toast.success('Saved — the storefront and checkout use it right away');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  const busy = (section: string) => state.isLoading && saving === section;

  return (
    <>
      <Section
        icon={<Truck className="size-5 text-primary-700" />}
        title="Delivery"
        saving={busy('delivery')}
        onSave={() =>
          void save('delivery', {
            shippingInsideDhaka: toPoisha(Number(delivery.inside || 0)),
            shippingOutsideDhaka: toPoisha(Number(delivery.outside || 0)),
            deliveryInsideDhaka: delivery.insideEta,
            deliveryOutsideDhaka: delivery.outsideEta,
          })
        }
      >
        <p className="text-sm text-ink-500">Charged per package at checkout and shown on every product page.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inside Dhaka fee (৳)" error={errors.shippingInsideDhaka}>
            <input className="input" inputMode="decimal" value={delivery.inside} onChange={(e) => setDelivery({ ...delivery, inside: e.target.value })} />
          </Field>
          <Field label="Outside Dhaka fee (৳)" error={errors.shippingOutsideDhaka}>
            <input className="input" inputMode="decimal" value={delivery.outside} onChange={(e) => setDelivery({ ...delivery, outside: e.target.value })} />
          </Field>
          <Field label="Inside Dhaka delivery time" error={errors.deliveryInsideDhaka}>
            <input className="input" value={delivery.insideEta} onChange={(e) => setDelivery({ ...delivery, insideEta: e.target.value })} />
          </Field>
          <Field label="Outside Dhaka delivery time" error={errors.deliveryOutsideDhaka}>
            <input className="input" value={delivery.outsideEta} onChange={(e) => setDelivery({ ...delivery, outsideEta: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section
        icon={<RotateCcw className="size-5 text-primary-700" />}
        title="Returns"
        saving={busy('returns')}
        onSave={() => void save('returns', { returnDays: Number(returns.days || 0), returnPolicy: returns.policy })}
      >
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <Field label="Return window (days)" error={errors.returnDays} hint="0 turns returns off">
            <input className="input" inputMode="numeric" value={returns.days} onChange={(e) => setReturns({ ...returns, days: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Return policy" error={errors.returnPolicy}>
            <textarea className="input h-24 py-2" value={returns.policy} onChange={(e) => setReturns({ ...returns, policy: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section
        icon={<MapPin className="size-5 text-primary-700" />}
        title="Store info"
        saving={busy('store')}
        onSave={() =>
          void save('store', {
            storeAddress: store.address,
            supportPhone: store.phone,
            supportEmail: store.email,
            supportHours: store.hours,
            socialLinks: Object.fromEntries(SOCIALS.map((k) => [k, store.social[k] ?? ''])),
          })
        }
      >
        <p className="text-sm text-ink-500">Shown in the storefront footer and help pages.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Address" error={errors.storeAddress}>
              <input className="input" value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} />
            </Field>
          </div>
          <Field label="Support phone" error={errors.supportPhone}>
            <input className="input" value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} />
          </Field>
          <Field label="Support email" error={errors.supportEmail}>
            <input className="input" type="email" value={store.email} onChange={(e) => setStore({ ...store, email: e.target.value })} />
          </Field>
          <Field label="Support hours" error={errors.supportHours}>
            <input className="input" value={store.hours} onChange={(e) => setStore({ ...store, hours: e.target.value })} />
          </Field>
          {SOCIALS.map((k) => (
            <Field key={k} label={`${k.charAt(0).toUpperCase()}${k.slice(1)} URL`} error={errors[`socialLinks.${k}`]}>
              <input
                className="input"
                placeholder="https://"
                value={store.social[k] ?? ''}
                onChange={(e) => setStore({ ...store, social: { ...store.social, [k]: e.target.value } })}
              />
            </Field>
          ))}
        </div>
      </Section>
    </>
  );
}
