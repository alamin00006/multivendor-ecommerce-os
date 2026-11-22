'use client';

import { errorMessage, useAddressesQuery, useDeleteAddressMutation, useUpdateAddressMutation } from '@marketbd/api-client';
import type { AddressView } from '@marketbd/shared';
import { Copy, MapPin, PencilLine, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AddressForm } from '@/components/forms/address-form';
import { useI18n, Button, cn, EmptyState, Modal, Skeleton } from '@marketbd/ui';

const MAX_ADDRESSES = 10;

/** "+8801622738449" → "+88 01622 738 449" for easier reading. */
const prettyPhone = (phone: string) => {
  const m = /^\+88(0\d{4})(\d{3})(\d{3})$/.exec(phone);
  return m ? `+88 ${m[1]} ${m[2]} ${m[3]}` : phone;
};

export default function AddressesPage() {
  const { t, pick } = useI18n();
  const { data, isLoading } = useAddressesQuery();
  const [remove, removeState] = useDeleteAddressMutation();
  const [update] = useUpdateAddressMutation();
  const [editing, setEditing] = useState<AddressView | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AddressView | null>(null);
  const full = (data?.length ?? 0) >= MAX_ADDRESSES;

  const lines = (a: AddressView) => [
    `${a.addressLine}${a.landmark ? `, ${a.landmark}` : ''}`,
    `${pick(a.area.name, a.area.nameBn)}, ${pick(a.district.name, a.district.nameBn)}, ${pick(a.division.name, a.division.nameBn)}`,
  ];

  const copy = async (a: AddressView) => {
    try {
      await navigator.clipboard.writeText([`${a.fullName}, ${a.phone}`, ...lines(a)].join('\n'));
      toast.success('Address copied');
    } catch {
      toast.error('Could not copy — your browser blocked the clipboard');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
        <h1 className="text-2xl font-semibold text-ink-900">Address Book</h1>
        <button
          type="button"
          onClick={() => setEditing('new')}
          disabled={full}
          title={full ? `You can save up to ${MAX_ADDRESSES} addresses` : undefined}
          className="flex items-center gap-1.5 rounded-md bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" /> Add New Address
        </button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : !data || data.length === 0 ? (
        <div className="rounded-lg bg-white shadow-card">
          <EmptyState
            icon={<MapPin />}
            title={t.account.noAddresses}
            text="Save an address for faster checkout."
            action={<Button onClick={() => setEditing('new')}>Add New Address</Button>}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.map((a) => (
            <li key={a.id} className="rounded-lg bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold text-ink-900">{a.fullName}</p>
                <p className="text-sm text-ink-800">{prettyPhone(a.phone)}</p>
              </div>
              <div className="mt-2 text-sm text-ink-500">
                {lines(a).map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-success">{a.label.toLowerCase()}</span>
                  {a.isDefault ? (
                    <span className="rounded-full bg-primary-700 px-2.5 py-0.5 text-xs font-semibold text-white">Default</span>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await update({ id: a.id, isDefault: true }).unwrap();
                          toast.success('Default address updated');
                        } catch (e) {
                          toast.error(errorMessage(e));
                        }
                      }}
                      className="rounded-full border border-ink-200 px-2.5 py-0.5 text-xs font-medium text-ink-600 hover:border-primary-400 hover:text-primary-700"
                    >
                      Set as default
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <button type="button" onClick={() => setEditing(a)} className="flex items-center gap-1 text-ink-700 hover:text-primary-700">
                    <PencilLine className="size-3.5" /> {t.common.edit}
                  </button>
                  <button type="button" onClick={() => void copy(a)} className="flex items-center gap-1 text-ink-700 hover:text-primary-700">
                    <Copy className="size-3.5" /> Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(a)}
                    disabled={a.isDefault}
                    title={a.isDefault ? 'Set another address as default before deleting this one' : undefined}
                    className={cn('flex items-center gap-1', a.isDefault ? 'cursor-not-allowed text-danger/35' : 'text-danger hover:underline')}
                  >
                    <Trash2 className="size-3.5" /> {t.common.delete}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add New Address' : 'Edit Address'} size="lg">
        {editing !== null && <AddressForm address={editing === 'new' ? undefined : editing} onSaved={() => setEditing(null)} />}
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete address?">
        {deleting && (
          <div className="space-y-4 text-sm">
            <p className="text-ink-600">
              <b className="text-ink-900">{deleting.fullName}</b>
              <br />
              {lines(deleting).join(', ')}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                loading={removeState.isLoading}
                onClick={async () => {
                  try {
                    await remove(deleting.id).unwrap();
                    toast.success('Address deleted');
                    setDeleting(null);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                {t.common.delete}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
