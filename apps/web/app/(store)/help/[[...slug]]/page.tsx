import { BRAND } from '@marketbd/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Article {
  title: string;
  body: string[];
}

const ARTICLES: Record<string, Article> = {
  about: {
    title: `About ${BRAND.name}`,
    body: [
      `${BRAND.name} is an online marketplace built for Bangladesh. We bring trusted sellers and our own official store together so you can shop everything from groceries to gadgets in one place.`,
      'Every order is packed and delivered by our logistics partners across all 64 districts, with Cash on Delivery available everywhere.',
    ],
  },
  careers: {
    title: 'Careers',
    body: ['We are always looking for engineers, designers, category managers and customer-care specialists. Send your CV to careers@marketbd.example.'],
  },
  returns: {
    title: 'Returns & refunds',
    body: [
      'You can request a return within 7 days of delivery from My Orders → Order details → Request return.',
      'Items must be unused, in original packaging, with all tags and accessories. Our team reviews requests within 2 working days.',
      'Refunds go back to the original payment method (bKash or card) within 5–7 working days after we receive the item. Cash on Delivery orders are refunded to your bKash number.',
    ],
  },
  privacy: {
    title: 'Privacy policy',
    body: [
      'We collect only the information needed to process your orders: your name, contact details, delivery addresses and order history.',
      'Payment details are handled by our licensed payment partners and are never stored on our servers.',
      'You can update your profile or request deletion of your account at any time by contacting support.',
    ],
  },
  terms: {
    title: 'Terms & conditions',
    body: [
      'Prices and availability may change without notice. Orders are confirmed once a seller accepts them.',
      'Sellers are responsible for the accuracy of their listings. We may remove listings that violate our policies.',
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const key = (await params).slug?.[0];
  return { title: key && ARTICLES[key] ? ARTICLES[key].title : 'Help center' };
}

export default async function HelpPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const key = (await params).slug?.[0];
  const article = key ? ARTICLES[key] : undefined;
  if (key && !article) notFound();
  return (
    <div className="container-site grid gap-4 pt-4 md:grid-cols-[220px_1fr]">
      <nav className="card h-fit p-2 text-sm">
        {Object.entries(ARTICLES).map(([slug, a]) => (
          <Link key={slug} href={`/help/${slug}`} className={`block rounded px-3 py-2 hover:bg-ink-50 ${slug === key ? 'font-semibold text-primary-700' : ''}`}>
            {a.title}
          </Link>
        ))}
      </nav>
      <article className="card space-y-3 p-6">
        <h1 className="font-display text-2xl font-bold">{article?.title ?? 'Help center'}</h1>
        {(article?.body ?? [
          `Need help with an order? Call ${BRAND.supportPhone} (9am–9pm, every day) or email ${BRAND.supportEmail}.`,
          'Choose a topic on the left for answers to common questions.',
        ]).map((p) => (
          <p key={p} className="leading-relaxed text-ink-700">
            {p}
          </p>
        ))}
      </article>
    </div>
  );
}
