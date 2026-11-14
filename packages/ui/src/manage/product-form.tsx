'use client';

import { productsPath } from '../urls';
import {
  errorMessage,
  useBrandsQuery,
  useCategoriesQuery,
  useCreateManagedProductMutation,
  useUpdateManagedProductMutation,
} from '@marketbd/api-client';
import { fromPoisha, type ManagedProduct, ProductSchema, toPoisha } from '@marketbd/shared';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../primitives';
import { ImageListField } from './image-upload';

interface VariantRow {
  id?: string;
  sku: string;
  attributes: Record<string, string>;
  price: string; // taka
  compareAtPrice: string; // taka
  stock: string;
  isActive: boolean;
}

interface OptionDim {
  name: string;
  values: string;
}

const toRow = (v: ManagedProduct['variants'][number]): VariantRow => ({
  id: v.id,
  sku: v.sku,
  attributes: v.attributes,
  price: String(fromPoisha(v.price)),
  compareAtPrice: v.compareAtPrice ? String(fromPoisha(v.compareAtPrice)) : '',
  stock: String(v.stock),
  isActive: v.isActive,
});

const cartesian = (dims: Array<{ name: string; values: string[] }>): Array<Record<string, string>> =>
  dims.reduce<Array<Record<string, string>>>(
    (acc, d) => acc.flatMap((combo) => d.values.map((v) => ({ ...combo, [d.name]: v }))),
    [{}],
  );

/** Create / edit form shared by the seller panel and the admin house-store products. */
export function ProductForm({ scope, product }: { scope: 'seller' | 'admin'; product?: ManagedProduct }) {
  const router = useRouter();
  const { data: categories = [] } = useCategoriesQuery();
  const { data: brands = [] } = useBrandsQuery();
  const [create, createState] = useCreateManagedProductMutation();
  const [update, updateState] = useUpdateManagedProductMutation();

  const [title, setTitle] = useState(product?.title ?? '');
  const [titleBn, setTitleBn] = useState(product?.titleBn ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [descriptionBn, setDescriptionBn] = useState(product?.descriptionBn ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [brandId, setBrandId] = useState(product?.brandId ?? '');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'INACTIVE'>(
    product?.status === 'DRAFT' || product?.status === 'INACTIVE' ? product.status : 'ACTIVE',
  );
  const [images, setImages] = useState<string[]>(product?.images.map((i) => i.url) ?? []);
  const [highlights, setHighlights] = useState<string[]>(product?.highlights.length ? product.highlights : ['']);
  const [specs, setSpecs] = useState<Array<{ label: string; value: string }>>(
    product?.specifications.length ? product.specifications : [{ label: '', value: '' }],
  );
  const [warranty, setWarranty] = useState(product?.warranty ?? '');
  const [variants, setVariants] = useState<VariantRow[]>(
    product?.variants.map(toRow) ?? [{ sku: '', attributes: {}, price: '', compareAtPrice: '', stock: '0', isActive: true }],
  );
  const [dims, setDims] = useState<OptionDim[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    setVariants((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const generate = () => {
    const parsed = dims
      .map((d) => ({ name: d.name.trim().toLowerCase(), values: d.values.split(',').map((v) => v.trim()).filter(Boolean) }))
      .filter((d) => d.name && d.values.length);
    if (!parsed.length) return;
    const base = variants[0];
    const prefix = (title.replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || 'SKU').toUpperCase();
    setVariants(
      cartesian(parsed).map((attributes, i) => {
        const existing = variants.find((v) => JSON.stringify(v.attributes) === JSON.stringify(attributes));
        return (
          existing ?? {
            sku: `${prefix}-${Object.values(attributes).map((v) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4)).join('-')}-${i + 1}`,
            attributes,
            price: base?.price ?? '',
            compareAtPrice: base?.compareAtPrice ?? '',
            stock: base?.stock ?? '0',
            isActive: true,
          }
        );
      }),
    );
  };

  const submit = async () => {
    const payload = {
      title,
      titleBn: titleBn || undefined,
      description,
      descriptionBn: descriptionBn || undefined,
      categoryId,
      brandId: brandId || null,
      status,
      // Empty rows are ignored so the form can always show a blank line to type into.
      highlights: highlights.map((h) => h.trim()).filter(Boolean),
      specifications: specs
        .map((row) => ({ label: row.label.trim(), value: row.value.trim() }))
        .filter((row) => row.label || row.value),
      warranty: warranty.trim() || null,
      images: images.map((url) => ({ url })),
      variants: variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        sku: v.sku.trim(),
        attributes: v.attributes,
        price: toPoisha(Number(v.price || 0)),
        compareAtPrice: v.compareAtPrice ? toPoisha(Number(v.compareAtPrice)) : null,
        stock: Number(v.stock || 0),
        isActive: v.isActive,
      })),
    };
    const parsed = ProductSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      toast.error(parsed.error.issues[0]?.message ?? 'Please fix the highlighted fields');
      return;
    }
    setErrors({});
    try {
      if (product) await update({ scope, id: product.id, body: payload }).unwrap();
      else await create({ scope, body: payload }).unwrap();
      toast.success(product ? 'Product updated' : 'Product created');
      router.push(productsPath(scope));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const err = (key: string) => (errors[key] ? <p className="field-error">{errors[key]}</p> : null);
  const leafCategories = categories.flatMap((c) => c.children.map((s) => ({ id: s.id, label: `${c.name} › ${s.name}` })));

  return (
    <div className="space-y-4">
      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          {err('title')}
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="titleBn">Title (বাংলা)</label>
          <input id="titleBn" className="input" value={titleBn} onChange={(e) => setTitleBn(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select…</option>
            {leafCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {err('categoryId')}
        </div>
        <div>
          <label className="label" htmlFor="brand">Brand</label>
          <select id="brand" className="input" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">No brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" className="input h-36 py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
          {err('description')}
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="descriptionBn">Description (বাংলা)</label>
          <textarea id="descriptionBn" className="input h-24 py-2" value={descriptionBn} onChange={(e) => setDescriptionBn(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="ACTIVE">Active (visible)</option>
            <option value="DRAFT">Draft</option>
            <option value="INACTIVE">Inactive (hidden)</option>
          </select>
        </div>
      </section>

      <section className="card grid gap-5 p-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 font-semibold">Key features</h3>
          <p className="mb-3 text-xs text-ink-500">Short bullet points shown on the product page.</p>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input"
                  placeholder="e.g. 5000 mAh battery with 45W fast charging"
                  value={h}
                  onChange={(e) => setHighlights((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remove feature"
                  onClick={() => setHighlights((all) => (all.length > 1 ? all.filter((_, j) => j !== i) : ['']))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {err('highlights')}
            {highlights.length < 20 && (
              <Button size="sm" variant="soft" onClick={() => setHighlights((all) => [...all, ''])}>
                <Plus className="size-4" /> Add feature
              </Button>
            )}
          </div>
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Specifications</h3>
          <p className="mb-3 text-xs text-ink-500">Label and value pairs, e.g. Battery → 5000 mAh.</p>
          <div className="space-y-2">
            {specs.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input w-40"
                  placeholder="Label"
                  value={row.label}
                  onChange={(e) => setSpecs((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  className="input flex-1"
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => setSpecs((all) => all.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remove specification"
                  onClick={() => setSpecs((all) => (all.length > 1 ? all.filter((_, j) => j !== i) : [{ label: '', value: '' }]))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {Object.entries(errors)
              .filter(([k]) => k.startsWith('specifications'))
              .slice(0, 1)
              .map(([k, m]) => (
                <p key={k} className="field-error">{m}</p>
              ))}
            {specs.length < 60 && (
              <Button size="sm" variant="soft" onClick={() => setSpecs((all) => [...all, { label: '', value: '' }])}>
                <Plus className="size-4" /> Add specification
              </Button>
            )}
          </div>
          <label className="label mt-4" htmlFor="warranty">Warranty</label>
          <input
            id="warranty"
            className="input"
            placeholder="e.g. 1 year brand warranty (leave empty for no warranty)"
            value={warranty}
            onChange={(e) => setWarranty(e.target.value)}
          />
          {err('warranty')}
        </div>
      </section>

      <section className="card p-5">
        <h3 className="mb-3 font-semibold">Images</h3>
        <ImageListField value={images} onChange={setImages} folder="products" />
        {err('images')}
      </section>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Variants, price & stock</h3>
          <Button size="sm" variant="ghost" onClick={() => setDims((d) => [...d, { name: '', values: '' }])}>
            <Plus className="size-4" /> Option
          </Button>
        </div>
        {dims.length > 0 && (
          <div className="mb-4 space-y-2 rounded-lg bg-ink-50 p-3">
            {dims.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input className="input w-36" placeholder="color" value={d.name} onChange={(e) => setDims((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input className="input flex-1" placeholder="Black, Blue, Red" value={d.values} onChange={(e) => setDims((all) => all.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} />
                <Button size="sm" variant="ghost" onClick={() => setDims((all) => all.filter((_, j) => j !== i))} aria-label="Remove option">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="soft" onClick={generate}>
              <Wand2 className="size-4" /> Generate variants
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-ink-500">
              <tr>
                <th className="py-2">Options</th>
                <th>SKU</th>
                <th>Price (৳)</th>
                <th>Compare at (৳)</th>
                <th>Stock</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={v.id ?? i} className="border-t border-ink-100 align-top">
                  <td className="py-2 pr-2 text-xs text-ink-600">{Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ') || 'Default'}</td>
                  <td className="pr-2">
                    <input className="input h-9" value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} />
                    {err(`variants.${i}.sku`)}
                  </td>
                  <td className="pr-2">
                    <input className="input h-9 w-28" inputMode="decimal" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} />
                    {err(`variants.${i}.price`)}
                  </td>
                  <td className="pr-2">
                    <input className="input h-9 w-28" inputMode="decimal" value={v.compareAtPrice} onChange={(e) => setVariant(i, { compareAtPrice: e.target.value })} />
                    {err(`variants.${i}.compareAtPrice`)}
                  </td>
                  <td className="pr-2">
                    <input className="input h-9 w-20" inputMode="numeric" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value.replace(/\D/g, '') })} />
                  </td>
                  <td className="pr-2 pt-2.5">
                    <input type="checkbox" className="accent-primary-700" checked={v.isActive} onChange={(e) => setVariant(i, { isActive: e.target.checked })} />
                  </td>
                  <td>
                    {variants.length > 1 && (
                      <Button size="sm" variant="ghost" onClick={() => setVariants((rows) => rows.filter((_, j) => j !== i))} aria-label="Remove variant">
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {err('variants')}
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button loading={createState.isLoading || updateState.isLoading} onClick={() => void submit()}>
          {product ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </div>
  );
}
