'use client';

import { errorMessage, useAdminBannersQuery, useAdminDeleteBannerMutation, useAdminSaveBannerMutation } from '@marketbd/api-client';
import { BANNER_PLACEMENTS, type BannerPlacement, BannerSchema, type BannerView, LINK_TARGET_TYPES, type LinkTargetType } from '@marketbd/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { fromLocalInput, issuesToErrors, toLocalInput } from '@/components/manage/form-utils';
import { ImageField } from '@/components/manage/image-upload';
import { PageHeader, Table } from '@/components/manage/panel';
import { Badge, Button, Modal, Skeleton } from '@/components/ui';

interface Draft {
  id?: string;
  title: string;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  placement: BannerPlacement;
  linkType: LinkTargetType;
  linkValue: string;
  sortOrder: number;
  isActive: boolean;
  startAt: string;
  endAt: string;
}

const fromView = (b: BannerView): Draft => ({ ...b, startAt: toLocalInput(b.startAt), endAt: toLocalInput(b.endAt) });

export default function AdminBannersPage() {
  const { data, isLoading } = useAdminBannersQuery();
  const [save, state] = useAdminSaveBannerMutation();
  const [remove] = useAdminDeleteBannerMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    if (!draft) return;
    const { id, ...rest } = draft;
    const body = {
      ...rest,
      imageUrl: rest.imageUrl ?? '',
      startAt: fromLocalInput(rest.startAt) ?? null,
      endAt: fromLocalInput(rest.endAt) ?? null,
    };
    const parsed = BannerSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setErrors({});
    try {
      await save({ id, body }).unwrap();
      toast.success('Banner saved');
      setDraft(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Home banners"
        description="Hero slider and mid-page banners."
        actions={<Button onClick={() => setDraft({ title: '', imageUrl: null, mobileImageUrl: null, placement: 'HOME_HERO', linkType: 'CATEGORY', linkValue: '', sortOrder: 0, isActive: true, startAt: '', endAt: '' })}><Plus className="size-4" /> Banner</Button>}
      />
      <div className="card">
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Banner', 'Placement', 'Link', 'Order', 'Status', '']}>
            {data?.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Image src={b.imageUrl} alt="" width={120} height={36} className="h-9 w-30 rounded object-cover" />
                    {b.title}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">{b.placement}</td>
                <td className="px-4 py-3 text-xs">{b.linkType}: {b.linkValue}</td>
                <td className="px-4 py-3">{b.sortOrder}</td>
                <td className="px-4 py-3"><Badge tone={b.isActive ? 'success' : 'neutral'}>{b.isActive ? 'Live' : 'Off'}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(fromView(b))} aria-label="Edit"><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => confirm('Delete banner?') && void remove(b.id)} aria-label="Delete"><Trash2 className="size-4 text-danger" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'Edit banner' : 'New banner'} size="lg">
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Title (alt text)</label>
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              {errors.title && <p className="field-error">{errors.title}</p>}
            </div>
            <div>
              <span className="label">Desktop image (1600×480)</span>
              <ImageField value={draft.imageUrl} onChange={(url) => setDraft({ ...draft, imageUrl: url })} folder="banners" />
              {errors.imageUrl && <p className="field-error">{errors.imageUrl}</p>}
            </div>
            <div>
              <span className="label">Mobile image (800×400)</span>
              <ImageField value={draft.mobileImageUrl} onChange={(url) => setDraft({ ...draft, mobileImageUrl: url })} folder="banners" />
            </div>
            <div>
              <label className="label">Placement</label>
              <select className="input" value={draft.placement} onChange={(e) => setDraft({ ...draft, placement: e.target.value as BannerPlacement })}>
                {BANNER_PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sort order</label>
              <input className="input" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Link type</label>
              <select className="input" value={draft.linkType} onChange={(e) => setDraft({ ...draft, linkType: e.target.value as LinkTargetType })}>
                {LINK_TARGET_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Link value (slug, search term or URL)</label>
              <input className="input" value={draft.linkValue} onChange={(e) => setDraft({ ...draft, linkValue: e.target.value })} />
              {errors.linkValue && <p className="field-error">{errors.linkValue}</p>}
            </div>
            <div>
              <label className="label">Starts (optional)</label>
              <input className="input" type="datetime-local" value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} />
            </div>
            <div>
              <label className="label">Ends (optional)</label>
              <input className="input" type="datetime-local" value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary-700" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active
            </label>
            <Button className="sm:col-span-2" loading={state.isLoading} onClick={() => void submit()}>Save</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
