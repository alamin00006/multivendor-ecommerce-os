import type { BannerView, CategoryNode, FlashSaleView, QuickLinkView } from '@marketbd/shared';
import {
  CategoryGrid,
  DealsFeed,
  FlashSaleSection,
  HeroSlider,
  MidBanners,
  QuickLinks,
} from '@/components/home/home-sections';
import { apiTry } from '@/lib/server-api';

export const revalidate = 60;

/** Home: hero → quick links → campaign banner → flash sale band → recommended categories → deals. */
export default async function HomePage() {
  const [hero, mid, quickLinks, flashSale, categories] = await Promise.all([
    apiTry<BannerView[]>('/banners?placement=HOME_HERO', { tags: ['banners'] }),
    apiTry<BannerView[]>('/banners?placement=HOME_MID', { tags: ['banners'] }),
    apiTry<QuickLinkView[]>('/quick-links', { tags: ['quick-links'] }),
    apiTry<FlashSaleView | null>('/flash-sales/active', { revalidate: 30, tags: ['flash-sale'] }),
    apiTry<CategoryNode[]>('/categories', { revalidate: 300, tags: ['categories'] }),
  ]);
  return (
    <div className="space-y-5 pt-3 md:space-y-6 md:pt-5">
      <div className="container-site space-y-4">
        <HeroSlider banners={hero ?? []} />
        <QuickLinks links={quickLinks ?? []} />
        <MidBanners banners={mid ?? []} />
      </div>
      <FlashSaleSection sale={flashSale} />
      <div className="container-site space-y-6">
        <CategoryGrid categories={categories ?? []} />
        <DealsFeed />
      </div>
    </div>
  );
}
