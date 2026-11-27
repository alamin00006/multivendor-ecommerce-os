// TEMPORARY demo content: imports a few products and the home hero banners from cartup.com into the
// local store through the admin API (house store). Everything created is listed in manifest.json so
// `node remove.mjs` can take it all out again. Replace with your own products and banners before launch.
//
// Usage (API running): node apps/api/scripts/cartup-import/import.mjs
// Env: API_URL (default http://localhost:4000/api/v1), ADMIN_EMAIL, ADMIN_PASSWORD, PER_CATEGORY (default 5)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'manifest.json');
const API = (process.env.API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const PER_CATEGORY = Number(process.env.PER_CATEGORY ?? 5);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36';
const S3 = 'https://sl-dev-s3.s3.amazonaws.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** cartup category → our top-level category. */
const SOURCES = [
  ['men_530', 'mens-fashion'],
  ['women_911', 'womens-fashion'],
  ['mobiles__tablets', 'electronic-devices'],
  ['mobile_accessories', 'electronic-accessories'],
  ['home_appliances', 'tv-home-appliances'],
  ['health__beauty', 'health-beauty'],
  ['groceries', 'groceries'],
  ['furniture__decor', 'home-lifestyle'],
  ['watches', 'watches-bags'],
  ['toys__games', 'babies-toys'],
  ['sports__outdoors', 'sports-outdoors'],
];

/** Hero banners on cartup's home page (1320×371). */
const HERO = [
  'admin/resources/6057fc40-ccdb-44dd-a28c-653715ab4eb5.jpg',
  'admin/resources/c93d5c31-1fe9-4f73-abfb-e728f317c73c.jpg',
  'admin/resources/dce24067-47a1-41b7-93ca-42066daedb6e.jpg',
  'admin/resources/d4d3a799-19d7-4b83-8b12-d4fbd76f9808.jpg',
  'admin/resources/0a1875f7-ccad-47e3-b41e-3b6933ed2bff.jpg',
  'admin/resources/92eae3d1-febf-447a-a875-7204e06a9f88.jpg',
];

// ───── cartup page parsing ─────

function flightOf(html) {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)]
    .map((m) => {
      try {
        return JSON.parse(`"${m[1]}"`);
      } catch {
        return '';
      }
    })
    .join('');
}

function objectAt(text, start) {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  return null;
}

/** The innermost object that contains `key` and has `prop`. */
function objectWith(text, key, prop) {
  const at = text.indexOf(key);
  if (at < 0) return null;
  for (let s = text.lastIndexOf('{', at); s >= 0; s = text.lastIndexOf('{', s - 1)) {
    try {
      const o = objectAt(text, s);
      if (o && o[prop] !== undefined) return o;
    } catch {
      /* keep walking out */
    }
  }
  return null;
}

async function page(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

/** Product URLs listed on a cartup category page (schema.org ItemList). */
async function categoryProducts(slug) {
  const flight = flightOf(await page(`https://cartup.com/category/${slug}`));
  return [...new Set([...flight.matchAll(/"url":"(https:\/\/cartup\.com\/product\/[^"]+)","sku":"(\d+)"/g)].map((m) => `${m[1]}?variantId=${m[2]}`))];
}

async function productDetails(url) {
  const flight = flightOf(await page(url));
  const details = objectWith(flight, '"productVariantsData"', 'productVariantsData');
  const content = objectWith(flight, '"productContentDetails"', 'productContentDetails')?.productContentDetails ?? null;
  return details ? { ...details, content } : null;
}

const stripHtml = (html) =>
  (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'item';

// ───── our admin API ─────

let token = '';
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json.message ?? ''}`);
  return json.data;
}

let lastUpload = 0;
/** Downloads an image and stores it in our storage (re-encoded to WebP by the API). */
async function upload(url, folder) {
  const img = await fetch(url, { headers: { 'user-agent': UA } });
  if (!img.ok) throw new Error(`image ${url} → ${img.status}`);
  const type = img.headers.get('content-type') ?? 'image/jpeg';
  const blob = new Blob([await img.arrayBuffer()], { type });
  // The upload endpoint allows 30 per minute.
  const wait = lastUpload + 2100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastUpload = Date.now();
  const form = new FormData();
  form.append('file', blob, `image.${type.split('/')[1] ?? 'jpg'}`);
  return (await api('POST', `/uploads/image?folder=${folder}`, form)).url;
}

/** Full banner body (the update endpoint expects every field). */
const bannerBody = (b, isActive) => ({
  title: b.title,
  imageUrl: b.imageUrl,
  mobileImageUrl: b.mobileImageUrl ?? null,
  placement: b.placement,
  linkType: b.linkType,
  linkValue: b.linkValue,
  sortOrder: b.sortOrder ?? 0,
  isActive,
  startAt: b.startAt ?? null,
  endAt: b.endAt ?? null,
});

// ───── import ─────

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { products: [], brands: [], banners: [], deactivatedBanners: [] };
const save = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

token = (
  await (
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL ?? 'admin@marketbd.example', password: process.env.ADMIN_PASSWORD ?? 'Admin@12345' }),
    })
  ).json()
).data.tokens.accessToken;

const categories = (await (await fetch(`${API}/categories`)).json()).data;
const brands = new Map((await (await fetch(`${API}/brands`)).json()).data.map((b) => [b.name.toLowerCase(), b.id]));

/** Our sub-category whose name shares the most words with cartup's category name. */
function pickCategory(topSlug, cartupName) {
  const top = categories.find((c) => c.slug === topSlug);
  if (!top) throw new Error(`No category ${topSlug}`);
  const words = new Set((cartupName ?? '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2));
  let best = top.children?.[0] ?? top;
  let score = 0;
  for (const c of top.children ?? []) {
    const s = c.name.toLowerCase().split(/[^a-z]+/).filter((w) => words.has(w) || words.has(w.replace(/s$/, ''))).length;
    if (s > score) [best, score] = [c, s];
  }
  return best.id;
}

async function brandId(name) {
  if (!name || /^no brand$/i.test(name.trim())) return null;
  const key = name.trim().toLowerCase();
  if (brands.has(key)) return brands.get(key);
  const created = await api('POST', '/admin/brands', { name: name.trim().slice(0, 80), slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}` });
  brands.set(key, created.id);
  manifest.brands.push(created.id);
  save();
  return created.id;
}

function variantsOf(d) {
  const rows = d.productVariantsData ?? [];
  const seen = new Set();
  return rows.map((v, i) => {
    let attributes = {};
    if (rows.length > 1) {
      // "Color-Black" or "Color-Black, Size-XL"
      for (const part of String(v.name ?? '').split(/,\s*/)) {
        const [k, ...rest] = part.split('-');
        const val = rest.join('-').trim();
        if (k && val) attributes[k.trim().slice(0, 40)] = val.slice(0, 60);
      }
      const key = JSON.stringify(attributes);
      if (!Object.keys(attributes).length || seen.has(key)) attributes = { Option: `Option ${i + 1}` };
      seen.add(JSON.stringify(attributes));
    }
    const price = Math.round(Number(v.discountedPrice ?? v.price) * 100);
    const mrp = Math.round(Number(v.price) * 100);
    return {
      sku: `CU-${v.id}`,
      attributes,
      price: Math.max(100, price),
      compareAtPrice: mrp > price ? mrp : null,
      stock: Math.min(300, Math.max(0, Number(v.totalStockQty ?? v.currentStockQty ?? 0))),
      isActive: v.isVariantAvailable !== false,
    };
  });
}

let added = 0;
for (const [source, ourTop] of SOURCES) {
  let urls = [];
  try {
    urls = await categoryProducts(source);
  } catch (e) {
    console.warn(`skip ${source}: ${e.message}`);
    continue;
  }
  let done = 0;
  for (const url of urls) {
    if (done >= PER_CATEGORY) break;
    if (manifest.products.some((p) => p.source === url)) {
      done++;
      continue;
    }
    try {
      const d = await productDetails(url);
      if (!d?.name || !d.productVariantsData?.length) continue;
      const files = [...new Set([...(d.images ?? []), ...(d.productVariantsData ?? []).map((v) => v.productVariantImage).filter(Boolean)])].slice(0, 3);
      if (!files.length) continue;
      const images = [];
      for (const f of files) images.push({ url: await upload(`${S3}/product/${f}`, 'products'), alt: d.name.slice(0, 120) });

      const title = d.name.trim().slice(0, 200);
      const highlights = [...String(d.content?.highlight ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((m) => stripHtml(m[1]).slice(0, 200))
        .filter((h) => h.length >= 2)
        .slice(0, 12);
      let description = stripHtml(d.content?.description).replace(/\{product_name\}/g, title);
      if (description.length < 20) description = `${title}. ${highlights.join('. ')}`.slice(0, 10_000);
      if (description.length < 20) description = `${title} — available now.`;
      const warranty = d.service?.warrantyType && !/no warranty/i.test(d.service.warrantyType) ? `${d.service.warrantyType} ${d.service.warrantyPeriod ?? ''}`.trim().slice(0, 120) : null;

      const product = await api('POST', '/admin/products', {
        title: title.length >= 5 ? title : `${title} item`,
        description: description.slice(0, 10_000),
        categoryId: pickCategory(ourTop, d.categoryName),
        brandId: await brandId(d.brandName),
        status: 'ACTIVE',
        highlights,
        specifications: [],
        warranty,
        images,
        variants: variantsOf(d),
      });
      manifest.products.push({ id: product.id, title, source: url });
      save();
      done++;
      added++;
      console.log(`✓ ${ourTop}: ${title}`);
    } catch (e) {
      console.warn(`✗ ${url}: ${e.message}`);
    }
    await sleep(400);
  }
}

// Hero banners: switch the current ones off (kept, not deleted) and add cartup's.
if (!manifest.banners.length) {
  const current = (await api('GET', '/admin/banners')).filter((b) => b.placement === 'HOME_HERO' && b.isActive);
  for (const b of current) {
    await api('PATCH', `/admin/banners/${b.id}`, bannerBody(b, false));
    manifest.deactivatedBanners.push(b.id);
    save();
  }
  for (const [i, path] of HERO.entries()) {
    try {
      const imageUrl = await upload(`${S3}/${path}`, 'banners');
      const banner = await api('POST', '/admin/banners', {
        title: `Hero banner ${i + 1}`,
        imageUrl,
        placement: 'HOME_HERO',
        linkType: 'CAMPAIGN',
        linkValue: 'winter-mega-sale',
        sortOrder: i,
        isActive: true,
      });
      manifest.banners.push(banner.id);
      save();
      console.log(`✓ hero banner ${i + 1}`);
    } catch (e) {
      console.warn(`✗ banner ${path}: ${e.message}`);
    }
  }
}

console.log(`\nDone: ${added} new products (${manifest.products.length} total), ${manifest.brands.length} brands, ${manifest.banners.length} hero banners.`);
console.log(`Remove everything again with: node ${join(HERE, 'remove.mjs')}`);
