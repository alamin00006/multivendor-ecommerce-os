'use client';

import {
  errorMessage,
  useAdminCategoriesQuery,
  useAdminCreateCategoryMutation,
  useAdminDeleteCategoryMutation,
  useAdminUpdateCategoryMutation,
} from '@marketbd/api-client';
import { type CategoryNode, CategorySchema } from '@marketbd/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { issuesToErrors, slugifyInput, ImageField, PageHeader, Badge, Button, Modal, Skeleton } from '@marketbd/ui';

interface Draft {
  id?: string;
  name: string;
  nameBn: string;
  slug: string;
  parentId: string | null;
  iconUrl: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

const empty = (parentId: string | null = null): Draft => ({ name: '', nameBn: '', slug: '', parentId, iconUrl: null, imageUrl: null, sortOrder: 0, isActive: true });

export default function AdminCategoriesPage() {
  const { data: tree, isLoading } = useAdminCategoriesQuery();
  const [create, createState] = useAdminCreateCategoryMutation();
  const [update, updateState] = useAdminUpdateCategoryMutation();
  const [remove] = useAdminDeleteCategoryMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const edit = (c: CategoryNode) =>
    setDraft({ id: c.id, name: c.name, nameBn: c.nameBn, slug: c.slug, parentId: c.parentId, iconUrl: c.iconUrl, imageUrl: c.imageUrl, sortOrder: c.sortOrder, isActive: c.isActive });

  const save = async () => {
    if (!draft) return;
    const { id, ...body } = draft;
    const parsed = CategorySchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setErrors({});
    try {
      if (id) await update({ id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success('Category saved');
      setDraft(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const row = (c: CategoryNode, depth: number) => (
    <li key={c.id}>
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-2" style={{ paddingLeft: 16 + depth * 28 }}>
        {c.iconUrl && <Image src={c.iconUrl} alt="" width={28} height={28} className="size-7 rounded" />}
        <span className="flex-1 text-sm">
          <b>{c.name}</b> <span className="text-ink-500">· {c.nameBn} · /{c.slug}</span>
        </span>
        {!c.isActive && <Badge tone="danger">Hidden</Badge>}
        {depth === 0 && (
          <Button size="sm" variant="ghost" onClick={() => setDraft(empty(c.id))}>
            <Plus className="size-4" /> Sub
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => edit(c)} aria-label="Edit"><Pencil className="size-4" /></Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Delete"
          onClick={async () => {
            if (!confirm(`Delete ${c.name}?`)) return;
            try {
              await remove(c.id).unwrap();
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          <Trash2 className="size-4 text-danger" />
        </Button>
      </div>
      {c.children.length > 0 && <ul>{c.children.map((s) => row(s, depth + 1))}</ul>}
    </li>
  );

  return (
    <div>
      <PageHeader title="Categories" actions={<Button onClick={() => setDraft(empty())}><Plus className="size-4" /> Category</Button>} />
      <div className="card overflow-hidden">{isLoading ? <Skeleton className="m-4 h-40" /> : <ul>{tree?.map((c) => row(c, 0))}</ul>}</div>

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'Edit category' : 'New category'} size="lg">
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.id ? draft.slug : slugifyInput(e.target.value) })} />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div>
              <label className="label">Name (বাংলা)</label>
              <input className="input" value={draft.nameBn} onChange={(e) => setDraft({ ...draft, nameBn: e.target.value })} />
              {errors.nameBn && <p className="field-error">{errors.nameBn}</p>}
            </div>
            <div>
              <label className="label">Slug</label>
              <input className="input" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
              {errors.slug && <p className="field-error">{errors.slug}</p>}
            </div>
            <div>
              <label className="label">Parent</label>
              <select className="input" value={draft.parentId ?? ''} onChange={(e) => setDraft({ ...draft, parentId: e.target.value || null })}>
                <option value="">— Top level —</option>
                {tree?.filter((c) => c.id !== draft.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Sort order</label>
              <input className="input" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" className="accent-primary-700" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Visible
            </label>
            <div>
              <span className="label">Icon</span>
              <ImageField value={draft.iconUrl} onChange={(url) => setDraft({ ...draft, iconUrl: url })} folder="categories" />
            </div>
            <div>
              <span className="label">Cover image</span>
              <ImageField value={draft.imageUrl} onChange={(url) => setDraft({ ...draft, imageUrl: url })} folder="categories" />
            </div>
            <Button className="sm:col-span-2" loading={createState.isLoading || updateState.isLoading} onClick={() => void save()}>Save</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
