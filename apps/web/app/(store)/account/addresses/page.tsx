'use client';

import { errorMessage, useAddressesQuery, useDeleteAddressMutation, useUpdateAddressMutation } from '@marketbd/api-client';
import type { AddressView } from '@marketbd/shared';
import { MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AddressForm } from '@/components/forms/address-form';
import { useI18n } from '@/i18n/client';
import { Badge, Button, EmptyState, Modal, Skeleton } from '@/components/ui';

export default function AddressesPage() {
  const { t, pick } = useI18n();
  const { data, isLoading } = useAddressesQuery();
  const [remove] = useDeleteAddressMutation();
  const [update] = useUpdateAddressMutation();
  const [editing, setEditing] = useState<AddressView | 'new' | null>(null);

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-semibold">{t.account.addresses}</h1>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" /> {t.checkout.addAddress}
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={<MapPin />} title={t.account.noAddresses} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((a) => (
            <li key={a.id} className="rounded-lg border border-ink-100 p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <b>{a.fullName}</b>
                <Badge>{a.label}</Badge>
                {a.isDefault && <Badge tone="primary">{t.account.default}</Badge>}
              </div>
              <p className="text-ink-600">{a.phone}</p>
              <p className="text-ink-600">
                {a.addressLine}, {pick(a.area.name, a.area.nameBn)}, {pick(a.district.name, a.district.nameBn)}, {pick(a.division.name, a.division.nameBn)}
              </p>
              <div className="mt-2 flex gap-3 text-xs font-semibold">
                <button type="button" className="text-primary-700" onClick={() => setEditing(a)}>
                  {t.common.edit}
                </button>
                {!a.isDefault && (
                  <button type="button" className="text-primary-700" onClick={() => void update({ id: a.id, isDefault: true })}>
                    {t.account.makeDefault}
                  </button>
                )}
                <button
                  type="button"
                  className="text-danger"
                  onClick={async () => {
                    try {
                      await remove(a.id).unwrap();
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  {t.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t.checkout.addAddress : t.common.edit} size="lg">
        {editing !== null && <AddressForm address={editing === 'new' ? undefined : editing} onSaved={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
