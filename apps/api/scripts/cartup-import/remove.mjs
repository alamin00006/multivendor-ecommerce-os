// Removes everything import.mjs added (products, brands, hero banners) and switches the previous
// hero banners back on. Usage (API running): node apps/api/scripts/cartup-import/remove.mjs
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'manifest.json');
const API = (process.env.API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
if (!existsSync(MANIFEST)) {
  console.log('Nothing to remove (no manifest.json).');
  process.exit(0);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const token = (
  await (
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL ?? 'admin@marketbd.example', password: process.env.ADMIN_PASSWORD ?? 'Admin@12345' }),
    })
  ).json()
).data.tokens.accessToken;
const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok && res.status !== 404) console.warn(`${method} ${path} → ${res.status}`);
};

// Undo categories.mjs: previous category pictures back.
for (const [id, prev] of Object.entries(manifest.categoryImages ?? {})) await call('PATCH', `/admin/categories/${id}`, prev);

// Undo showcase.mjs first: flash sale items, campaign products, demo products back on.
if (manifest.flashSale) {
  const res = await fetch(`${API}/admin/flash-sales/${manifest.flashSale.id}`, { headers: { authorization: `Bearer ${token}` } });
  if (res.ok) {
    const sale = (await res.json()).data;
    await call('PATCH', `/admin/flash-sales/${sale.id}`, { title: sale.title, titleBn: sale.titleBn ?? undefined, startAt: sale.startAt, endAt: sale.endAt, isActive: sale.isActive, items: manifest.flashSale.items });
  }
}
for (const [campaignId, ids] of Object.entries(manifest.campaignProducts ?? {})) await call('POST', `/admin/campaigns/${campaignId}/products/remove`, { productIds: ids });
for (const id of manifest.deactivatedProducts ?? []) await call('PATCH', `/admin/products/${id}/status`, { status: 'ACTIVE' });

for (const p of manifest.products) await call('DELETE', `/admin/products/${p.id}`); // products with orders are switched off instead
for (const id of manifest.banners) await call('DELETE', `/admin/banners/${id}`);
const res = await fetch(`${API}/admin/banners`, { headers: { authorization: `Bearer ${token}` } });
const all = res.ok ? (await res.json()).data : [];
for (const id of manifest.deactivatedBanners) {
  const b = all.find((x) => x.id === id);
  if (!b) continue;
  await call('PATCH', `/admin/banners/${id}`, {
    title: b.title,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl ?? null,
    placement: b.placement,
    linkType: b.linkType,
    linkValue: b.linkValue,
    sortOrder: b.sortOrder ?? 0,
    isActive: true,
    startAt: b.startAt ?? null,
    endAt: b.endAt ?? null,
  });
}
for (const id of manifest.brands) await call('PATCH', `/admin/brands/${id}`, { isActive: false });
rmSync(MANIFEST);
console.log(`Removed ${manifest.products.length} products and ${manifest.banners.length} banners; ${manifest.brands.length} brands switched off; previous hero banners restored.`);
