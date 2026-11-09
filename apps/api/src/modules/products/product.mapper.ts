import {
  discountPercent,
  type FlashPrice,
  type ManagedProduct,
  type ProductCard,
  type SellerSummary,
  type VariantView,
} from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { asAttributes, num } from '../../common/utils.js';

export const sellerSummarySelect = {
  id: true,
  shopName: true,
  slug: true,
  logoUrl: true,
  ratingAvg: true,
  isHouseStore: true,
  status: true,
} satisfies Prisma.SellerProfileSelect;

export const productCardInclude = {
  seller: { select: sellerSummarySelect },
  variants: { where: { isActive: true }, orderBy: { price: 'asc' } },
  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
} satisfies Prisma.ProductInclude;

export type ProductForCard = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

export type FlashMap = Map<string, FlashPrice>;

type SellerRow = Prisma.SellerProfileGetPayload<{ select: typeof sellerSummarySelect }>;

export const toSellerSummary = (s: SellerRow): SellerSummary => ({
  id: s.id,
  shopName: s.shopName,
  slug: s.slug,
  logoUrl: s.logoUrl,
  ratingAvg: num(s.ratingAvg),
  isHouseStore: s.isHouseStore,
});

/** Effective unit price for a variant: flash price when an active flash sale has stock left. */
export const effectivePrice = (variant: { id: string; price: number }, flash: FlashMap) => {
  const f = flash.get(variant.id);
  return f && f.soldCount < f.stockLimit ? f.specialPrice : variant.price;
};

export const toVariantView = (v: Prisma.ProductVariantGetPayload<object>, flash: FlashMap): VariantView => {
  const f = flash.get(v.id) ?? null;
  return {
    id: v.id,
    sku: v.sku,
    attributes: asAttributes(v.attributes),
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    stock: v.stock,
    isActive: v.isActive,
    flash: f && f.soldCount < f.stockLimit ? f : null,
  };
};

/** Product card for listings. The cheapest purchasable variant drives the displayed price. */
export const toProductCard = (p: ProductForCard, flash: FlashMap, multiVendor: boolean): ProductCard => {
  const variants = p.variants.length ? p.variants : [];
  let best = variants[0];
  let bestPrice = best ? effectivePrice(best, flash) : p.minPrice;
  for (const v of variants) {
    const price = effectivePrice(v, flash);
    if (price < bestPrice || (best && best.stock === 0 && v.stock > 0)) {
      best = v;
      bestPrice = price;
    }
  }
  const bestFlash = best ? flash.get(best.id) : undefined;
  const activeFlash = bestFlash && bestFlash.soldCount < bestFlash.stockLimit ? bestFlash : null;
  const compareAt = activeFlash ? (best?.compareAtPrice ?? best?.price ?? null) : (best?.compareAtPrice ?? null);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    titleBn: p.titleBn,
    imageUrl: p.images[0]?.url ?? null,
    price: bestPrice,
    compareAtPrice: compareAt && compareAt > bestPrice ? compareAt : null,
    discountPercent: discountPercent(bestPrice, compareAt),
    ratingAvg: num(p.ratingAvg),
    ratingCount: p.ratingCount,
    soldCount: p.soldCount,
    inStock: variants.some((v) => v.stock > 0),
    seller: multiVendor ? toSellerSummary(p.seller) : null,
    flash: activeFlash,
  };
};

export const managedProductInclude = {
  seller: { select: sellerSummarySelect },
  variants: { orderBy: { createdAt: 'asc' } },
  images: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude;

export type ProductForManage = Prisma.ProductGetPayload<{ include: typeof managedProductInclude }>;

export const toManagedProduct = (p: ProductForManage): ManagedProduct => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  titleBn: p.titleBn,
  description: p.description,
  descriptionBn: p.descriptionBn,
  status: p.status,
  categoryId: p.categoryId,
  brandId: p.brandId,
  seller: toSellerSummary(p.seller),
  imageUrl: p.images[0]?.url ?? null,
  images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, variantId: i.variantId })),
  variants: p.variants.map((v) => toVariantView(v, new Map())),
  minPrice: p.minPrice,
  totalStock: p.variants.reduce((sum, v) => sum + v.stock, 0),
  soldCount: p.soldCount,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

/** Option dimensions across variants, preserving first-seen order. */
export const collectOptions = (variants: Array<{ attributes: unknown }>): Record<string, string[]> => {
  const options: Record<string, string[]> = {};
  for (const v of variants) {
    for (const [key, value] of Object.entries(asAttributes(v.attributes))) {
      const list = (options[key] ??= []);
      if (!list.includes(value)) list.push(value);
    }
  }
  return options;
};
