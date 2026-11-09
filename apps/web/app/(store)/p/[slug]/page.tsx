import { BRAND, fromPoisha, type ProductDetail } from '@marketbd/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ProductView } from '@/components/product/product-view';
import { getDictionary } from '@/i18n/server';
import { apiGet, SITE_URL } from '@/lib/server-api';

export const revalidate = 60;

const load = (slug: string) =>
  apiGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { revalidate: 60, tags: [`product:${slug}`] });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await load((await params).slug);
  if (!product) return { title: 'Product not found' };
  const description = product.description.slice(0, 160);
  return {
    title: product.title,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: { title: product.title, description, images: product.images.slice(0, 1).map((i) => i.url), type: 'website' },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, { locale }] = await Promise.all([load(slug), getDictionary()]);
  if (!product) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.images.map((i) => i.url),
    description: product.description,
    sku: product.variants[0]?.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    aggregateRating:
      product.ratingCount > 0
        ? { '@type': 'AggregateRating', ratingValue: product.ratingAvg, reviewCount: product.ratingCount }
        : undefined,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/p/${product.slug}`,
      priceCurrency: 'BDT',
      price: fromPoisha(product.price).toFixed(2),
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: product.seller?.shopName ?? BRAND.name },
    },
  };

  return (
    <div className="container-site pt-3">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Breadcrumbs
        items={[
          ...product.breadcrumbs.map((b) => ({ label: locale === 'bn' ? b.nameBn : b.name, href: `/c/${b.slug}` })),
          { label: product.title },
        ]}
      />
      <ProductView product={product} />
    </div>
  );
}
