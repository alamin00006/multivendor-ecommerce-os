'use client';

import { errorMessage, useAdminCampaignsQuery, useAdminDeleteCampaignMutation, useAdminSaveCampaignMutation } from '@marketbd/api-client';
import { CAMPAIGN_TYPES, type CampaignType, CampaignSchema, type CampaignView } from '@marketbd/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { fromLocalInput, issuesToErrors, slugifyInput, toLocalInput } from '@/components/manage/form-utils';
import { ImageField } from '@/components/manage/image-upload';
import { fmtDate, PageHeader, Table } from '@/components/manage/panel';
import { Badge, Button, Modal, Skeleton } from '@/components/ui';

interface Draft {
  id?: string;
  slug: string;
  title: string;
  titleBn: string;
  description: string;
  bannerUrl: string | null;
  mobileBannerUrl: string | null;
  themeColor: string;
  type: CampaignType;
  startAt: string;
  endAt: string;
  isActive: boolean;
  sortOrder: number;
}

const fromView = (c: CampaignView): Draft => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  titleBn: c.titleBn ?? '',
  description: c.description ?? '',
  bannerUrl: c.bannerUrl,
  mobileBannerUrl: c.mobileBannerUrl,
  themeColor: c.themeColor ?? '#08755a',
  type: c.type,
  startAt: toLocalInput(c.startAt),
  endAt: toLocalInput(c.endAt),
  isActive: c.isActive,
  sortOrder: c.sortOrder,
});

export default function AdminCampaignsPage() {
  const { data, isLoading } = useAdminCampaignsQuery();
  const [save, state] = useAdminSaveCampaignMutation();
  const [remove] = useAdminDeleteCampaignMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    if (!draft) return;
    const { id, ...d } = draft;
    const body = {
      ...d,
      titleBn: d.titleBn || undefined,
      description: d.description || undefined,
      bannerUrl: d.bannerUrl ?? '',
      startAt: fromLocalInput(d.startAt) ?? '',
      endAt: fromLocalInput(d.endAt) ?? '',
    };
    const parsed = CampaignSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setErrors({});
    try {
      await save({ id, body }).unwrap();
      toast.success('Campaign saved');
      setDraft(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const [now] = useState(() => Date.now());
  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Mega sale pages rendered at /campaign/[slug]."
        actions={
          <Button
            onClick={() =>
              setDraft({ slug: '', title: '', titleBn: '', description: '', bannerUrl: null, mobileBannerUrl: null, themeColor: '#08755a', type: 'MEGA_SALE', startAt: toLocalInput(new Date().toISOString()), endAt: '', isActive: true, sortOrder: 0 })
            }
          >
            <Plus className="size-4" /> Campaign
          </Button>
        }
      />
      <div className="card">
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Campaign', 'Type', 'Window', 'Products', 'Status', '']}>
            {data?.map((c) => {
              const live = c.isActive && new Date(c.startAt).getTime() <= now && new Date(c.endAt).getTime() > now;
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <Image src={c.bannerUrl} alt="" width={96} height={30} className="h-8 w-24 rounded object-cover" />
                      <span>
                        <Link href={`/admin/campaigns/${c.id}`} className="font-medium text-primary-700">{c.title}</Link>
                        <br />
                        <span className="text-xs text-ink-500">/campaign/{c.slug}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.type}</td>
                  <td className="px-4 py-3 text-xs">{fmtDate(c.startAt)}<br />→ {fmtDate(c.endAt)}</td>
                  <td className="px-4 py-3">{c.productCount}</td>
                  <td className="px-4 py-3"><Badge tone={live ? 'success' : 'neutral'}>{live ? 'Live' : c.isActive ? 'Scheduled/ended' : 'Off'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDraft(fromView(c))} aria-label="Edit"><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${c.title}?`) && void remove(c.id)} aria-label="Delete"><Trash2 className="size-4 text-danger" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </div>
      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'Edit campaign' : 'New campaign'} size="lg">
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Title</label>
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value, slug: draft.id ? draft.slug : slugifyInput(e.target.value) })} />
              {errors.title && <p className="field-error">{errors.title}</p>}
            </div>
            <div>
              <label className="label">Title (বাংলা)</label>
              <input className="input" value={draft.titleBn} onChange={(e) => setDraft({ ...draft, titleBn: e.target.value })} />
            </div>
            <div>
              <label className="label">Slug</label>
              <input className="input" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
              {errors.slug && <p className="field-error">{errors.slug}</p>}
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as CampaignType })}>
                {CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="input h-20 py-2" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Starts</label>
              <input className="input" type="datetime-local" value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} />
              {errors.startAt && <p className="field-error">{errors.startAt}</p>}
            </div>
            <div>
              <label className="label">Ends</label>
              <input className="input" type="datetime-local" value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} />
              {errors.endAt && <p className="field-error">{errors.endAt}</p>}
            </div>
            <div>
              <label className="label">Theme colour</label>
              <input className="input h-10 p-1" type="color" value={draft.themeColor} onChange={(e) => setDraft({ ...draft, themeColor: e.target.value })} />
            </div>
            <div>
              <label className="label">Sort order</label>
              <input className="input" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
            </div>
            <div>
              <span className="label">Banner (1600×480)</span>
              <ImageField value={draft.bannerUrl} onChange={(url) => setDraft({ ...draft, bannerUrl: url })} folder="campaigns" />
              {errors.bannerUrl && <p className="field-error">{errors.bannerUrl}</p>}
            </div>
            <div>
              <span className="label">Mobile banner</span>
              <ImageField value={draft.mobileBannerUrl} onChange={(url) => setDraft({ ...draft, mobileBannerUrl: url })} folder="campaigns" />
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
