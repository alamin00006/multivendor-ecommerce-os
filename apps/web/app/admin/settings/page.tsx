'use client';

import { errorMessage, usePublicSettingsQuery, useUpdateSettingsMutation } from '@marketbd/api-client';
import { AlertTriangle, Store, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/manage/panel';
import { Button, cn, Modal, Skeleton } from '@/components/ui';

export default function SettingsPage() {
  const { data, isLoading } = usePublicSettingsQuery();
  const [update, state] = useUpdateSettingsMutation();
  const [confirming, setConfirming] = useState(false);
  if (isLoading || !data) return <Skeleton className="h-48" />;
  const on = data.multiVendorEnabled;
  const target = !on;

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Settings" />
      <section className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              {on ? <Users className="size-5 text-primary-700" /> : <Store className="size-5 text-primary-700" />}
              Multi-vendor marketplace
            </h3>
            <p className="mt-1 text-sm text-ink-600">
              {on
                ? 'ON — approved sellers can list products and receive orders. Orders are split per seller.'
                : 'OFF — the site runs as a single store. Only house-store products are visible.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => setConfirming(true)}
            className={cn('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-primary-600' : 'bg-ink-300')}
          >
            <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
            <span className="sr-only">Toggle multi-vendor mode</span>
          </button>
        </div>
      </section>

      <Modal open={confirming} onClose={() => setConfirming(false)} title={target ? 'Turn multi-vendor ON?' : 'Switch to single-vendor store?'}>
        <div className="space-y-3 text-sm text-ink-700">
          <p className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            This takes effect immediately for every visitor. No data is deleted.
          </p>
          {target ? (
            <ul className="list-disc space-y-1 pl-5">
              <li>Seller registration, seller login and the Seller Center open again.</li>
              <li>Products of approved sellers become visible again (their status is unchanged).</li>
              <li>Shop names, &ldquo;Sold by&rdquo; blocks and seller ratings appear on the storefront.</li>
              <li>New orders are split into one package per seller with commission.</li>
            </ul>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              <li>Seller registration, /seller pages and seller APIs are disabled.</li>
              <li>Only house-store products are listed. Other sellers&apos; products are hidden, not deleted.</li>
              <li>Carts containing hidden products mark them unavailable and block checkout for them.</li>
              <li>Seller menus and commission reports are hidden from this panel.</li>
              <li>Existing orders, carts and reviews are kept as they are.</li>
            </ul>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button
              loading={state.isLoading}
              onClick={async () => {
                try {
                  await update({ multiVendorEnabled: target }).unwrap();
                  toast.success(target ? 'Multi-vendor mode is ON' : 'Single-vendor mode is ON');
                  setConfirming(false);
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
