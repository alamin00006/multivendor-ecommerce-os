import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProductCard, ProductDetail, ProductFacets, ProductListParams, SearchSuggestion } from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PaginatedResult } from '../../common/pagination.js';
import { num } from '../../common/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toBrandView } from '../brands/brands.module.js';
import { CategoriesService, toCategoryRef } from '../categories/categories.service.js';
import { FlashSalesService } from '../flash-sales/flash-sales.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';
import {
  collectOptions,
  productCardInclude,
  type ProductForCard,
  sellerSummarySelect,
  toProductCard,
  toVariantView,
} from './product.mapper.js';
import { type ListFilters, ProductQueryService } from './product-query.service.js';

const SORTS: Record<Exclude<ProductListParams['sort'], 'relevance'>, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  popular: [{ soldCount: 'desc' }],
  price_asc: [{ minPrice: 'asc' }],
  price_desc: [{ minPrice: 'desc' }],
  rating: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: PlatformModeService,
    private readonly query: ProductQueryService,
    private readonly flashSales: FlashSalesService,
    private readonly categories: CategoriesService,
  ) {}

  /** Maps products to cards with live flash prices and mode-aware seller info. */
  async toCards(products: ProductForCard[]): Promise<ProductCard[]> {
    const [flash, multiVendor] = await Promise.all([
      this.flashSales.priceMap(products.flatMap((p) => p.variants.map((v) => v.id))),
      this.mode.isMultiVendor(),
    ]);
    return products.map((p) => toProductCard(p, flash, multiVendor));
  }

  async list(params: ProductListParams): Promise<PaginatedResult<ProductCard>> {
    const { page, limit, sort, q, ...filters } = params;
    const where = await this.query.buildWhere(filters);

    if (q) {
      const rankedIds = await this.query.searchIds(q);
      const matching = await this.prisma.product.findMany({
        where: { AND: [where, { id: { in: rankedIds } }] },
        select: { id: true },
        ...(sort !== 'relevance' ? { orderBy: SORTS[sort] } : {}),
      });
      let ids = matching.map((m) => m.id);
      if (sort === 'relevance') {
        const rank = new Map(rankedIds.map((id, i) => [id, i]));
        ids = ids.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
      }
      const pageIds = ids.slice((page - 1) * limit, page * limit);
      const rows = await this.prisma.product.findMany({ where: { id: { in: pageIds } }, include: productCardInclude });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered = pageIds.map((id) => byId.get(id)).filter((r): r is ProductForCard => Boolean(r));
      return PaginatedResult.of(await this.toCards(ordered), page, limit, ids.length);
    }

    const orderBy =
      sort === 'relevance' ? [{ soldCount: 'desc' as const }, { createdAt: 'desc' as const }] : SORTS[sort];
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productCardInclude,
        orderBy: [...orderBy, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return PaginatedResult.of(await this.toCards(rows), page, limit, total);
  }

  async facets(params: Omit<ProductListParams, 'page' | 'limit' | 'sort'>): Promise<ProductFacets> {
    const { q, ...rest } = params;
    // Facets ignore brand/price/attribute selections so users can widen them again.
    const filters: ListFilters = { category: rest.category, seller: rest.seller, campaign: rest.campaign };
    const where = await this.query.buildWhere(filters);
    const scoped: Prisma.ProductWhereInput = q
      ? { AND: [where, { id: { in: await this.query.searchIds(q) } }] }
      : where;

    const [brandGroups, price, variants] = await Promise.all([
      this.prisma.product.groupBy({
        by: ['brandId'],
        where: { AND: [scoped, { brandId: { not: null } }] },
        _count: true,
      }),
      this.prisma.product.aggregate({ where: scoped, _min: { minPrice: true }, _max: { minPrice: true } }),
      this.prisma.productVariant.findMany({
        where: { isActive: true, product: scoped },
        select: { attributes: true },
        take: 3000,
      }),
    ]);
    const brands = await this.prisma.brand.findMany({
      where: { id: { in: brandGroups.map((b) => b.brandId).filter((id): id is string => Boolean(id)) } },
    });
    const counts = new Map(brandGroups.map((b) => [b.brandId, b._count]));
    return {
      brands: brands
        .map((b) => ({ slug: b.slug, name: b.name, count: counts.get(b.id) ?? 0 }))
        .sort((a, b) => b.count - a.count),
      priceRange: { min: price._min.minPrice ?? 0, max: price._max.minPrice ?? 0 },
      attributes: collectOptions(variants),
    };
  }

  async bySlug(slug: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findFirst({
      where: { AND: [{ slug }, await this.mode.visibleProductWhere()] },
      include: {
        seller: { select: sellerSummarySelect },
        category: true,
        brand: true,
        variants: { where: { isActive: true }, orderBy: { price: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const [flash, multiVendor, breadcrumbs] = await Promise.all([
      this.flashSales.priceMap(product.variants.map((v) => v.id)),
      this.mode.isMultiVendor(),
      this.categories.breadcrumbs(product.categoryId),
    ]);
    const card = toProductCard({ ...product, images: product.images.slice(0, 1) }, flash, multiVendor);
    return {
      ...card,
      description: product.description,
      descriptionBn: product.descriptionBn,
      status: product.status,
      category: toCategoryRef(product.category),
      breadcrumbs,
      brand: product.brand ? toBrandView(product.brand) : null,
      images: product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, variantId: i.variantId })),
      variants: product.variants.map((v) => toVariantView(v, flash)),
      options: collectOptions(product.variants),
      createdAt: product.createdAt.toISOString(),
      ratingAvg: num(product.ratingAvg),
    };
  }

  async related(slug: string, limit = 12): Promise<ProductCard[]> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true, categoryId: true, brandId: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const visible = await this.mode.visibleProductWhere();
    const rows = await this.prisma.product.findMany({
      where: {
        AND: [visible, { id: { not: product.id } }],
        OR: [{ categoryId: product.categoryId }, ...(product.brandId ? [{ brandId: product.brandId }] : [])],
      },
      include: productCardInclude,
      orderBy: [{ soldCount: 'desc' }, { id: 'asc' }],
      take: limit,
    });
    return this.toCards(rows);
  }

  async suggest(q: string, limit: number): Promise<SearchSuggestion> {
    const ids = await this.query.searchIds(q, 50);
    const visible = await this.mode.visibleProductWhere();
    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: { AND: [visible, { id: { in: ids } }] },
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      }),
      this.prisma.category.findMany({
        where: {
          isActive: true,
          OR: [{ name: { contains: q, mode: 'insensitive' } }, { nameBn: { contains: q } }],
        },
        take: 4,
      }),
    ]);
    const rank = new Map(ids.map((id, i) => [id, i]));
    const sorted = products.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)).slice(0, limit);
    const lower = q.toLowerCase();
    const keywords = [
      ...new Set(
        sorted
          .map((p) => p.title.toLowerCase())
          .filter((t) => t.includes(lower))
          .map((t) => t.slice(t.indexOf(lower)).split(' ').slice(0, 3).join(' ')),
      ),
    ].slice(0, 5);
    return {
      products: sorted.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        imageUrl: p.images[0]?.url ?? null,
        price: p.minPrice,
      })),
      categories: categories.map(toCategoryRef),
      keywords,
    };
  }

  /** Visible products for a list of ids, in the given order (used by campaigns & wishlist). */
  async cardsByIds(ids: string[]): Promise<ProductCard[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.product.findMany({
      where: { AND: [await this.mode.visibleProductWhere(), { id: { in: ids } }] },
      include: productCardInclude,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return this.toCards(ids.map((id) => byId.get(id)).filter((r): r is ProductForCard => Boolean(r)));
  }
}
