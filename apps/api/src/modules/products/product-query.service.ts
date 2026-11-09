import { Injectable } from '@nestjs/common';
import type { ProductListParams } from '@marketbd/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';

/** Turns free text into a prefix-matching tsquery, e.g. "red sha" → "red:* & sha:*". */
export const toTsQuery = (q: string): string | null => {
  const tokens = q
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 8);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(' & ') : null;
};

const parseAttrFilters = (attrs: string[] | undefined): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const pair of attrs ?? []) {
    const [key, ...rest] = pair.split(':');
    const value = rest.join(':');
    if (!key || !value) continue;
    map.set(key, [...(map.get(key) ?? []), value]);
  }
  return map;
};

export type ListFilters = Omit<ProductListParams, 'page' | 'limit' | 'sort'>;

@Injectable()
export class ProductQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: PlatformModeService,
    private readonly categories: CategoriesService,
  ) {}

  /** Product ids matching a search phrase, best match first. */
  async searchIds(q: string, limit = 1000): Promise<string[]> {
    const tsQuery = toTsQuery(q);
    if (!tsQuery) return [];
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT p.id
      FROM "Product" p
      WHERE p."searchVector" @@ to_tsquery('simple', ${tsQuery})
         OR p.title ILIKE ${like}
         OR p."titleBn" ILIKE ${like}
      ORDER BY ts_rank(p."searchVector", to_tsquery('simple', ${tsQuery})) DESC,
               similarity(p.title, ${q}) DESC,
               p."soldCount" DESC
      LIMIT ${limit}
    `);
    return rows.map((r) => r.id);
  }

  /** Storefront where-clause for the given filters (without text search). */
  async buildWhere(filters: ListFilters): Promise<Prisma.ProductWhereInput> {
    const and: Prisma.ProductWhereInput[] = [await this.mode.visibleProductWhere()];

    if (filters.category) {
      const category = await this.prisma.category.findUnique({ where: { slug: filters.category } });
      const ids = category ? await this.categories.descendantIds(category.id) : [];
      and.push({ categoryId: { in: ids } });
    }
    if (filters.brand?.length) and.push({ brand: { slug: { in: filters.brand } } });
    if (filters.seller) and.push({ seller: { slug: filters.seller } });
    if (filters.minPrice !== undefined) and.push({ minPrice: { gte: filters.minPrice } });
    if (filters.maxPrice !== undefined) and.push({ minPrice: { lte: filters.maxPrice } });
    if (filters.rating !== undefined) and.push({ ratingAvg: { gte: filters.rating } });
    if (filters.inStock) and.push({ variants: { some: { isActive: true, stock: { gt: 0 } } } });
    if (filters.campaign) {
      and.push({ campaigns: { some: { campaign: { slug: filters.campaign, isActive: true } } } });
    }
    for (const [key, values] of parseAttrFilters(filters.attrs)) {
      and.push({
        variants: {
          some: {
            isActive: true,
            OR: values.map((value) => ({ attributes: { path: [key], equals: value } })),
          },
        },
      });
    }
    return { AND: and };
  }
}
