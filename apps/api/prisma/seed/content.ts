/**
 * Product-page and category-page content for the demo catalog: key features,
 * specifications, warranty, category buying guides and a few Q&A threads.
 * Idempotent — only fills fields that are still empty, so it is safe on an existing database.
 * All copy is original, written for this project.
 */
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { CATEGORIES, type ProductTemplate } from './catalog-data.js';

const slugify = (input: string) =>
  input
    .toLowerCase()
    .replace(/["'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Electronics carry a brand warranty; other categories do not. */
const WARRANTY_BY_ROOT: Record<string, string> = {
  'electronic-devices': '1 year brand warranty',
  'electronic-accessories': '6 months brand warranty',
  'tv-home-appliances': '1 year brand warranty (2 years on the motor)',
  'automotive-motorbike': '6 months seller warranty',
};

const highlightsFor = (t: ProductTemplate): string[] => {
  const fromDescription = t.description
    .replace(/\.$/, '')
    .split(/,\s*|\s+with\s+|\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  return [...fromDescription, 'Cash on Delivery available across Bangladesh'].slice(0, 6);
};

const specificationsFor = (t: ProductTemplate, categoryName: string) => [
  { label: 'Brand', value: t.brand },
  { label: 'Model', value: t.title.replace(new RegExp(`^${t.brand}\\s*`), '') },
  { label: 'Category', value: categoryName },
  ...Object.entries(t.options).map(([key, values]) => ({
    label: key.charAt(0).toUpperCase() + key.slice(1),
    value: values.join(', '),
  })),
  { label: 'Country of origin', value: 'Bangladesh / Imported' },
];

const guideFor = (name: string, subs: string[]) => `## ${name} prices in Bangladesh

Shop ${name.toLowerCase()} online with Cash on Delivery to all 64 districts. Compare prices, read verified reviews and pick the option that fits your budget — from everyday essentials to premium picks.

### Popular sub-categories

${subs.map((s) => `- **${s}**`).join('\n')}

### How to choose

1. **Set a budget first.** Use the price filter on the left to see only what fits.
2. **Check ratings and reviews.** Products marked *Verified purchase* were reviewed by real buyers.
3. **Compare specifications.** Open two products side by side and compare their key features.
4. **Look for vouchers.** Apply a coupon at checkout for an extra discount.

### Frequently asked questions

**Is Cash on Delivery available?**
Yes. You can pay in cash when the parcel arrives, anywhere in Bangladesh.

**How long does delivery take?**
Inside Dhaka usually 1–2 days, outside Dhaka 3–5 days.

**Can I return a product?**
Yes. Unused items in their original packaging can be returned within the return window shown on each product page.
`;

const QUESTIONS: Array<{ q: string; a?: string }> = [
  { q: 'Is this the original product?', a: 'Yes, all items are 100% authentic and sourced from the brand or its official distributor.' },
  { q: 'How many days will delivery take to Chattogram?', a: 'Usually 3–5 working days outside Dhaka.' },
  { q: 'Is there any warranty card in the box?', a: 'Warranty details are listed on the product page. Keep your invoice for any claim.' },
  { q: 'Can I get this in a different colour?' },
  { q: 'Is Cash on Delivery available for this item?', a: 'Yes, Cash on Delivery is available everywhere in Bangladesh.' },
];

export async function seedContent(prisma: PrismaClient): Promise<void> {
  let products = 0;
  for (const cat of CATEGORIES) {
    for (const sub of cat.children) {
      for (const t of sub.products) {
        const slug = slugify(t.title);
        const { count } = await prisma.product.updateMany({
          where: { slug, highlights: { isEmpty: true } },
          data: {
            highlights: highlightsFor(t),
            specifications: specificationsFor(t, sub.name),
            warranty: WARRANTY_BY_ROOT[cat.slug] ?? null,
          },
        });
        products += count;
      }
    }
    await prisma.category.updateMany({
      where: { slug: cat.slug, seoContent: null },
      data: { seoContent: guideFor(cat.name, cat.children.map((c) => c.name)) },
    });
  }

  let questions = 0;
  if ((await prisma.productQuestion.count()) === 0) {
    const [askers, admin, picks] = await Promise.all([
      prisma.user.findMany({ where: { role: 'CUSTOMER' }, select: { id: true }, orderBy: { createdAt: 'asc' } }),
      prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } }),
      prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, seller: { select: { userId: true, isHouseStore: true } } },
        orderBy: { soldCount: 'desc' },
        take: 20,
      }),
    ]);
    for (const [i, product] of picks.entries()) {
      for (const [j, item] of QUESTIONS.slice(0, 2 + (i % 3)).entries()) {
        const asker = askers[(i + j) % askers.length];
        if (!asker) continue;
        // House-store questions are answered by staff; seller products by the seller.
        const answerer = product.seller.isHouseStore ? admin?.id : product.seller.userId;
        await prisma.productQuestion.create({
          data: {
            productId: product.id,
            userId: asker.id,
            question: item.q,
            ...(item.a && answerer ? { answer: item.a, answeredById: answerer, answeredAt: new Date() } : {}),
          },
        });
        questions += 1;
      }
    }
  }
  console.log(`✓ content: ${products} products with features/specs, category guides, ${questions} questions`);
}
