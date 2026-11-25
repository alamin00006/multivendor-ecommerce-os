import type { CampaignView } from '@marketbd/shared';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CampaignProducts, CampaignVouchers } from '@/components/campaign/campaign-sections';
import { CampaignTimer } from '@/components/home/campaign-timer';
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

/** Campaign landing page: full-width banner, vouchers to collect, terms and the campaign's products. */
export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [campaign, { locale }] = await Promise.all([load(slug), getDictionary()]);
  if (!campaign) notFound();
  const title = locale === 'bn' && campaign.titleBn ? campaign.titleBn : campaign.title;
  const accent = campaign.themeColor ?? '#08755a';
  return (
    <div className="pb-4">
      <h1 className="sr-only">{title}</h1>
      {/* Full-width banner; the mobile artwork is used on small screens when provided. */}
      <div className="relative w-full" style={{ backgroundColor: `${accent}1a` }}>
        <div className="relative mx-auto hidden aspect-[1600/320] max-w-[1600px] sm:block">
          <Image src={campaign.bannerUrl} alt={title} fill priority sizes="100vw" className="object-cover" />
        </div>
        <div className="relative aspect-[2/1] sm:hidden">
          <Image src={campaign.mobileBannerUrl ?? campaign.bannerUrl} alt={title} fill priority sizes="100vw" className="object-cover" />
        </div>
      </div>

      <div className="container-site space-y-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {campaign.description ? <p className="text-sm text-ink-600">{campaign.description}</p> : <span />}
          <CampaignTimer endsAt={campaign.endAt} />
        </div>

        <CampaignVouchers codes={campaign.voucherCodes} />

        {campaign.terms.length > 0 && (
          <section className="card p-5 md:p-8">
            <h2 className="inline-block rounded-lg px-4 py-2 font-display text-xl font-bold text-white md:text-2xl" style={{ backgroundColor: accent }}>
              Terms &amp; Conditions
            </h2>
            <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm font-medium text-ink-800 md:text-base">
              {campaign.terms.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </section>
        )}

        <CampaignProducts slug={slug} />
      </div>
    </div>
  );
}
