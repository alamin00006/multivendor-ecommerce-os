import type { CampaignView, CategoryNode, ProductCard } from '@marketbd/shared';
import type { MetadataRoute } from 'next';
import { apiGetPage, apiTry, SITE_URL } from '@/lib/server-api';

export const revalidate = 3600;

const MAX_PRODUCT_PAGES = 50; // 50 × 100 = 5,000 products per sitemap

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/flash-sale`, lastModified: now, changeFrequency: 'hourly', priority: 0.7 },
  ];

  const [categories, campaigns] = await Promise.all([
    apiTry<CategoryNode[]>('/categories', { revalidate: 3600 }),
    apiTry<CampaignView[]>('/campaigns', { revalidate: 3600 }),
  ]);
  for (const c of categories ?? []) {
    entries.push({ url: `${SITE_URL}/c/${c.slug}`, changeFrequency: 'daily', priority: 0.8 });
    for (const s of c.children) entries.push({ url: `${SITE_URL}/c/${s.slug}`, changeFrequency: 'daily', priority: 0.7 });
  }
  for (const c of campaigns ?? []) {
    entries.push({ url: `${SITE_URL}/campaign/${c.slug}`, changeFrequency: 'daily', priority: 0.8 });
  }

  for (let page = 1; page <= MAX_PRODUCT_PAGES; page += 1) {
    const res = await apiGetPage<ProductCard>(`/products?limit=100&page=${page}&sort=newest`, { revalidate: 3600 }).catch(() => null);
    if (!res) break;
    for (const p of res.items) entries.push({ url: `${SITE_URL}/p/${p.slug}`, changeFrequency: 'weekly', priority: 0.6 });
    if (page >= res.meta.totalPages) break;
  }
  return entries;
}
