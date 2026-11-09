'use client';

import { errorMessage, useAdminDeleteQuickLinkMutation, useAdminQuickLinksQuery, useAdminSaveQuickLinkMutation } from '@marketbd/api-client';
import { LINK_TARGET_TYPES, type LinkTargetType, QuickLinkSchema, type QuickLinkView } from '@marketbd/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { issuesToErrors } from '@/components/manage/form-utils';
import { ImageField } from '@/components/manage/image-upload';
import { PageHeader, Table } from '@/components/manage/panel';
import { Badge, Button, Modal, Skeleton } from '@/components/ui';

type Draft = Omit<QuickLinkView, 'id' | 'iconUrl'> & { id?: string; iconUrl: string | null };

export default function AdminQuickLinksPage() {
  const { data, isLoading } = useAdminQuickLinksQuery();
  const [save, state] = useAdminSaveQuickLinkMutation();
  const [remove] = useAdminDeleteQuickLinkMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    if (!draft) return;
    const { id, ...rest } = draft;
    const body = { ...rest, iconUrl: rest.iconUrl ?? '' };
    const parsed = QuickLinkSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setErrors({});
    try {
      await save({ id, body }).unwrap();
      toast.success('Quick link saved');
      setDraft(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Quick links"
        description="Icon chips shown under the home slider."
        actions={<Button onClick={() => setDraft({ label: '', labelBn: '', iconUrl: null, linkType: 'CATEGORY', linkValue: '', sortOrder: 0, isActive: true })}><Plus className="size-4" /> Quick link</Button>}
      />
      <div className="card">
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Chip', 'Link', 'Order', 'Status', '']}>
            {data?.map((q) => (
              <tr key={q.id}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <Image src={q.iconUrl} alt="" width={32} height={32} className="size-8 rounded-lg" /> {q.label} · {q.labelBn}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{q.linkType}: {q.linkValue}</td>
                <td className="px-4 py-3">{q.sortOrder}</td>
                <td className="px-4 py-3"><Badge tone={q.isActive ? 'success' : 'neutral'}>{q.isActive ? 'Live' : 'Off'}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(q)} aria-label="Edit"><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => confirm('Delete quick link?') && void remove(q.id)} aria-label="Delete"><Trash2 className="size-4 text-danger" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'Edit quick link' : 'New quick link'}>
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Label</label>
              <input className="input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              {errors.label && <p className="field-error">{errors.label}</p>}
            </div>
            <div>
              <label className="label">Label (বাংলা)</label>
              <input className="input" value={draft.labelBn} onChange={(e) => setDraft({ ...draft, labelBn: e.target.value })} />
              {errors.labelBn && <p className="field-error">{errors.labelBn}</p>}
            </div>
            <div>
              <label className="label">Link type</label>
              <select className="input" value={draft.linkType} onChange={(e) => setDraft({ ...draft, linkType: e.target.value as LinkTargetType })}>
                {LINK_TARGET_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Link value</label>
              <input className="input" value={draft.linkValue} onChange={(e) => setDraft({ ...draft, linkValue: e.target.value })} />
              {errors.linkValue && <p className="field-error">{errors.linkValue}</p>}
            </div>
            <div>
              <label className="label">Sort order</label>
              <input className="input" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" className="accent-primary-700" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active
            </label>
            <div className="sm:col-span-2">
              <span className="label">Icon</span>
              <ImageField value={draft.iconUrl} onChange={(url) => setDraft({ ...draft, iconUrl: url })} folder="banners" />
              {errors.iconUrl && <p className="field-error">{errors.iconUrl}</p>}
            </div>
            <Button className="sm:col-span-2" loading={state.isLoading} onClick={() => void submit()}>Save</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
