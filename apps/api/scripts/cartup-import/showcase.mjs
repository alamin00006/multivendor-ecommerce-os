// Makes the imported cartup products the ones shoppers see: switches the old demo products off
// (kept, not deleted), puts imported products in the active flash sale and in the campaigns.
// Everything changed is recorded in manifest.json; remove.mjs puts it all back.
// Usage (after import.mjs, API running): node apps/api/scripts/cartup-import/showcase.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'manifest.json');
const API = (process.env.API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
manifest.deactivatedProducts ??= [];
manifest.campaignProducts ??= {};
const save = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

const token = (
  await (
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL ?? 'admin@marketbd.example', password: process.env.ADMIN_PASSWORD ?? 'Admin@12345' }),
    })
  ).json()
).data.tokens.accessToken;
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json.message ?? ''}`);
  return json;
}

const imported = new Set(manifest.products.map((p) => p.id));

// 1. Old demo products off
let page = 1;
let off = 0;
for (;;) {
  const res = await api('GET', `/admin/products?page=${page}&limit=50`);
  for (const p of res.data) {
    if (imported.has(p.id) || p.status !== 'ACTIVE') continue;
    await api('PATCH', `/admin/products/${p.id}/status`, { status: 'INACTIVE' });
    manifest.deactivatedProducts.push(p.id);
    off++;
  }
  save();
  if (page >= (res.meta?.totalPages ?? 1)) break;
  page++;
}
console.log(`✓ ${off} demo products switched off`);

// 2. Flash sale with imported products (15% off, up to 50 each)
const active = (await api('GET', '/flash-sales/active')).data;
if (active && !manifest.flashSale) {
  const sale = (await api('GET', `/admin/flash-sales/${active.id}`)).data;
  manifest.flashSale = {
    id: sale.id,
    items: sale.items.map((i) => ({ variantId: i.variantId, specialPrice: i.specialPrice, stockLimit: i.stockLimit, sortOrder: i.sortOrder })),
  };
  save();
  const items = [];
  for (const p of manifest.products) {
    if (items.length >= 12) break;
    const product = (await api('GET', `/admin/products/${p.id}`)).data;
    const v = product.variants.find((x) => x.isActive && x.stock > 0 && x.price >= 20000);
    if (!v) continue;
    items.push({ variantId: v.id, specialPrice: Math.round((v.price * 0.85) / 100) * 100, stockLimit: Math.min(50, v.stock), sortOrder: items.length });
  }
  await api('PATCH', `/admin/flash-sales/${sale.id}`, { title: sale.title, titleBn: sale.titleBn ?? undefined, startAt: sale.startAt, endAt: sale.endAt, isActive: sale.isActive, items });
  console.log(`✓ flash sale now has ${items.length} imported products`);
}

// 3. Campaigns: add the imported products
const campaigns = (await api('GET', '/admin/campaigns')).data;
for (const c of campaigns) {
  if (manifest.campaignProducts[c.id]) continue;
  const ids = manifest.products.map((p) => p.id);
  await api('POST', `/admin/campaigns/${c.id}/products`, { productIds: ids });
  manifest.campaignProducts[c.id] = ids;
  save();
  console.log(`✓ campaign "${c.title}": ${ids.length} products added`);
}
console.log('Done. Undo everything with remove.mjs.');
