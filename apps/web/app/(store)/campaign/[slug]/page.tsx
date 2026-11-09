import type { CampaignView } from '@marketbd/shared';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CampaignTimer } from '@/components/home/campaign-timer';
import { ProductListing } from '@/components/product/product-listing';
import { getDictionary } from '@/i18n/server';
import { apiGet } from '@/lib/server-api';

export const revalidate = 60;

const load = (slug: string) => apiGet<CampaignView>(`/campaigns/${encodeURIComponent(slug)}`, { tags: ['campaigns'] });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const campaign = await load((await params).slug);
  if (!campaign) return {};
  return {
    title: campaign.title,
    description: campaign.description ?? undefined,
    openGraph: { images: [campaign.bannerUrl] },
    alternates: { canonical: `/campaign/${campaign.slug}` },
  };
}

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [campaign, { locale }] = await Promise.all([load(slug), getDictionary()]);
  if (!campaign) notFound();
  const title = locale === 'bn' && campaign.titleBn ? campaign.titleBn : campaign.title;
  const accent = campaign.themeColor ?? '#08755a';
  return (
    <div style={{ backgroundColor: `${accent}14` }} className="pb-4">
      <div className="container-site space-y-4 pt-3">
        <div className="relative aspect-[2/1] overflow-hidden rounded-xl md:aspect-[10/3]">
          <Image src={campaign.bannerUrl} alt={title} fill priority sizes="1200px" className="object-cover" />
        </div>
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4" style={{ borderTop: `4px solid ${accent}` }}>
          <div>
            <h1 className="font-display text-2xl font-bold">{title}</h1>
            {campaign.description && <p className="mt-1 text-sm text-ink-600">{campaign.description}</p>}
          </div>
          <CampaignTimer endsAt={campaign.endAt} />
        </div>
        <Suspense>
          <ProductListing fixed={{ campaign: slug }} />
        </Suspense>
      </div>
    </div>
  );
}
