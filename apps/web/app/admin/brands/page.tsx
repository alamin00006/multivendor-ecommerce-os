'use client';

import {
  errorMessage,
  useAdminBrandsQuery,
  useAdminCreateBrandMutation,
  useAdminDeleteBrandMutation,
  useAdminUpdateBrandMutation,
} from '@marketbd/api-client';
import { BrandSchema, type BrandView } from '@marketbd/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { issuesToErrors, slugifyInput } from '@/components/manage/form-utils';
import { ImageField } from '@/components/manage/image-upload';
import { PageHeader, Table } from '@/components/manage/panel';
import { Badge, Button, Modal, Skeleton } from '@/components/ui';

type Draft = Omit<BrandView, 'id'> & { id?: string };

export default function AdminBrandsPage() {
  const { data, isLoading } = useAdminBrandsQuery();
  const [create, cs] = useAdminCreateBrandMutation();
  const [update, us] = useAdminUpdateBrandMutation();
  const [remove] = useAdminDeleteBrandMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async () => {
    if (!draft) return;
    const { id, ...body } = draft;
    const parsed = BrandSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setErrors({});
    try {
      if (id) await update({ id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success('Brand saved');
      setDraft(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader title="Brands" actions={<Button onClick={() => setDraft({ name: '', slug: '', logoUrl: null, isActive: true })}><Plus className="size-4" /> Brand</Button>} />
      <div className="card">
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Brand', 'Slug', 'Status', '']}>
            {data?.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    {b.logoUrl && <Image src={b.logoUrl} alt="" width={32} height={32} className="size-8 rounded" />}
                    <b>{b.name}</b>
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-500">{b.slug}</td>
                <td className="px-4 py-3"><Badge tone={b.isActive ? 'success' : 'neutral'}>{b.isActive ? 'Active' : 'Hidden'}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(b)} aria-label="Edit"><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Delete" onClick={async () => {
                      if (!confirm(`Delete ${b.name}?`)) return;
                      try { await remove(b.id).unwrap(); } catch (e) { toast.error(errorMessage(e)); }
                    }}><Trash2 className="size-4 text-danger" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'Edit brand' : 'New brand'}>
        {draft && (
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.id ? draft.slug : slugifyInput(e.target.value) })} />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div>
              <label className="label">Slug</label>
              <input className="input" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
              {errors.slug && <p className="field-error">{errors.slug}</p>}
            </div>
            <ImageField value={draft.logoUrl} onChange={(url) => setDraft({ ...draft, logoUrl: url })} folder="brands" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary-700" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active
            </label>
            <Button block loading={cs.isLoading || us.isLoading} onClick={() => void save()}>Save</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
