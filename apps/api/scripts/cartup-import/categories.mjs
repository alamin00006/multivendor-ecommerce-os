// Gives the categories real pictures: top-level categories get cartup's round category images,
// sub-categories get a photo of an imported product in them (or the parent's picture).
// Previous icon/image URLs are kept in manifest.json; remove.mjs restores them.
// Usage (after import.mjs, API running): node apps/api/scripts/cartup-import/categories.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'manifest.json');
const API = (process.env.API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const S3 = 'https://sl-dev-s3.s3.amazonaws.com/admin/resources';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
manifest.categoryImages ??= {};
const save = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

/** Our top-level slug → cartup's category picture. */
const TOP = {
  'electronic-devices': 'phones-accessories-1739453706928.png',
  'electronic-accessories': 'electronic-accessories-1739453603406.png',
  'tv-home-appliances': 'tv-home-appliance-1739453546671.png',
  'health-beauty': 'health-beauty-1739453480173.png',
  'babies-toys': 'mothers-baby-care-1739453666417.png',
  groceries: 'groceries-pet-supply-1740042013960.png',
  'pet-supplies': 'groceries-pet-supply-1740042013960.png',
  'home-lifestyle': 'home-living-1753698068269.png',
  'womens-fashion': '58135951-c2c5-4692-bc2c-e334388248dc.png',
  'mens-fashion': 'alt-men-s-fashion-1739454090154.png',
  'watches-bags': 'watches-bags-1739453629792.png',
  'sports-outdoors': 'sports-outdoors-1739453653455.png',
  'automotive-motorbike': 'automotive-motorcycle-1739453692433.png',
  'books-stationery': 'lifestyle-hobbies-1753698033594.png',
  'computers-laptops': 'alt-computing-gaming-1739453309025.png',
};

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
  const isForm = body instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body && !isForm ? { 'content-type': 'application/json' } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json.message ?? ''}`);
  return json.data;
}

let lastUpload = 0;
async function upload(url) {
  const img = await fetch(url, { headers: { 'user-agent': UA } });
  if (!img.ok) throw new Error(`image ${url} → ${img.status}`);
  const type = img.headers.get('content-type') ?? 'image/png';
  const wait = lastUpload + 2100 - Date.now(); // upload endpoint: 30 per minute
  if (wait > 0) await sleep(wait);
  lastUpload = Date.now();
  const form = new FormData();
  form.append('file', new Blob([await img.arrayBuffer()], { type }), `image.${type.split('/')[1] ?? 'png'}`);
  return (await api('POST', '/uploads/image?folder=categories', form)).url;
}

// Imported product photos, grouped by category.
const photoByCategory = {};
for (const p of manifest.products) {
  const product = await api('GET', `/admin/products/${p.id}`);
  const url = product.images?.[0]?.url ?? product.imageUrl;
  if (url) (photoByCategory[product.categoryId] ??= []).push(url);
}

async function setImage(cat, url) {
  if (!(cat.id in manifest.categoryImages)) manifest.categoryImages[cat.id] = { iconUrl: cat.iconUrl ?? null, imageUrl: cat.imageUrl ?? null };
  await api('PATCH', `/admin/categories/${cat.id}`, { iconUrl: url, imageUrl: url });
  save();
}

const tree = await api('GET', '/admin/categories');
const walk = (nodes, fn, parent = null) => nodes.forEach((n) => (fn(n, parent), walk(n.children ?? [], fn, n)));
const pictures = {};
const cartupUploads = {};
// Top level first so children can fall back to the parent's picture.
for (const top of tree) {
  const file = TOP[top.slug];
  let url;
  if (file) url = cartupUploads[file] ??= await upload(`${S3}/${file}`);
  else url = photoByCategory[top.id]?.[0];
  if (!url) continue;
  await setImage(top, url);
  pictures[top.id] = url;
  console.log(`✓ ${top.name}${file ? ' (cartup)' : ''}`);
}
const used = new Set();
const subs = [];
walk(tree, (n, parent) => parent && subs.push([n, parent]));
for (const [cat, parent] of subs) {
  const own = (photoByCategory[cat.id] ?? []).find((u) => !used.has(u));
  const url = own ?? pictures[parent.id];
  if (!url) continue;
  used.add(url);
  await setImage(cat, url);
  pictures[cat.id] = url;
  console.log(`✓   ${parent.name} › ${cat.name}${own ? '' : ' (parent picture)'}`);
}
console.log('Done. remove.mjs restores the previous pictures.');
