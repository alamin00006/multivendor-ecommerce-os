import type { z } from 'zod';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LOW_STOCK_THRESHOLD,
  type ManagedProduct,
  ManageProductListQuerySchema,
  type ProductPayload,
  type ProductStatus,
  type UpdateProductPayload,
  type UpdateStockInput,
  type VariantPayload,
} from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { randomSuffix, slugify } from '../../common/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { managedProductInclude, toManagedProduct } from './product.mapper.js';

/** Restricts management operations to one seller, or none (admin). */
export interface ProductScope {
  sellerId?: string;
}

type ListQuery = z.infer<typeof ManageProductListQuerySchema>;

const minActivePrice = (variants: Array<Pick<VariantPayload, 'price' | 'isActive'>>): number => {
  const active = variants.filter((v) => v.isActive !== false);
  const pool = active.length ? active : variants;
  return pool.length ? Math.min(...pool.map((v) => v.price)) : 0;
};

const variantData = (v: VariantPayload) => ({
  sku: v.sku.toUpperCase(),
  attributes: v.attributes ?? {},
  price: v.price,
  compareAtPrice: v.compareAtPrice ?? null,
  stock: Number(v.stock),
  isActive: v.isActive ?? true,
});

@Injectable()
export class ProductManageService {
  constructor(private readonly prisma: PrismaService) {}

  private scopeWhere(scope: ProductScope): Prisma.ProductWhereInput {
    return scope.sellerId ? { sellerId: scope.sellerId } : {};
  }

  async list(scope: ProductScope, query: ListQuery): Promise<PaginatedResult<ManagedProduct>> {
    const where: Prisma.ProductWhereInput = {
      ...this.scopeWhere(scope),
      ...(query.status ? { status: query.status } : {}),
      ...(query.sellerId && !scope.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: query.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
      ...(query.lowStock ? { variants: { some: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } } } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: managedProductInclude,
        orderBy: { updatedAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.product.count({ where }),
    ]);
    return PaginatedResult.of(rows.map(toManagedProduct), query.page, query.limit, total);
  }

  async get(scope: ProductScope, id: string): Promise<ManagedProduct> {
    const product = await this.prisma.product.findFirst({
      where: { id, ...this.scopeWhere(scope) },
      include: managedProductInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return toManagedProduct(product);
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = slugify(base) || 'product';
    let slug = root;
    while (await this.prisma.product.findFirst({ where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) } })) {
      slug = `${root}-${randomSuffix(5)}`;
    }
    return slug;
  }

  private async assertRefs(categoryId?: string, brandId?: string | null): Promise<void> {
    if (categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
        include: { _count: { select: { children: true } } },
      });
      if (!category) throw new BadRequestException('Category not found');
      if (category._count.children > 0) throw new BadRequestException('Choose a sub-category, not a parent category');
    }
    if (brandId && !(await this.prisma.brand.findUnique({ where: { id: brandId } }))) {
      throw new BadRequestException('Brand not found');
    }
  }

  async create(sellerId: string, input: ProductPayload): Promise<ManagedProduct> {
    await this.assertRefs(input.categoryId, input.brandId);
    const slug = input.slug ? await this.uniqueSlug(input.slug) : await this.uniqueSlug(input.title);
    const product = await this.prisma.product.create({
      data: {
        sellerId,
        title: input.title,
        titleBn: input.titleBn,
        slug,
        description: input.description,
        descriptionBn: input.descriptionBn,
        categoryId: input.categoryId,
        brandId: input.brandId ?? null,
        status: input.status ?? 'ACTIVE',
        highlights: input.highlights ?? [],
        specifications: input.specifications ?? [],
        warranty: input.warranty || null,
        minPrice: minActivePrice(input.variants),
        variants: { create: input.variants.map(variantData) },
        images: { create: input.images.map((img, i) => ({ url: img.url, alt: img.alt ?? input.title, sortOrder: i })) },
      },
      include: managedProductInclude,
    });
    return toManagedProduct(product);
  }

  async update(scope: ProductScope, id: string, input: UpdateProductPayload): Promise<ManagedProduct> {
    const current = await this.prisma.product.findFirst({
      where: { id, ...this.scopeWhere(scope) },
      include: { variants: { include: { _count: { select: { orderItems: true } } } } },
    });
    if (!current) throw new NotFoundException('Product not found');
    await this.assertRefs(input.categoryId, input.brandId);

    await this.prisma.$transaction(async (tx) => {
      if (input.variants) {
        const incomingIds = new Set(input.variants.map((v) => v.id).filter(Boolean));
        for (const existing of current.variants) {
          if (incomingIds.has(existing.id)) continue;
          if (existing._count.orderItems > 0) {
            await tx.productVariant.update({ where: { id: existing.id }, data: { isActive: false } });
          } else {
            await tx.productVariant.delete({ where: { id: existing.id } });
          }
        }
        for (const v of input.variants) {
          if (v.id) {
            if (!current.variants.some((e) => e.id === v.id)) throw new BadRequestException('Unknown variant');
            await tx.productVariant.update({ where: { id: v.id }, data: variantData(v) });
          } else {
            await tx.productVariant.create({ data: { ...variantData(v), productId: id } });
          }
        }
      }
      if (input.images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productImage.createMany({
          data: input.images.map((img, i) => ({
            productId: id,
            url: img.url,
            alt: img.alt ?? input.title ?? current.title,
            sortOrder: i,
          })),
        });
      }
      const variants = await tx.productVariant.findMany({ where: { productId: id } });
      await tx.product.update({
        where: { id },
        data: {
          title: input.title,
          titleBn: input.titleBn,
          slug: input.slug && input.slug !== current.slug ? await this.uniqueSlug(input.slug, id) : undefined,
          description: input.description,
          descriptionBn: input.descriptionBn,
          categoryId: input.categoryId,
          brandId: input.brandId,
          status: input.status,
          highlights: input.highlights,
          specifications: input.specifications,
          warranty: input.warranty === undefined ? undefined : input.warranty || null,
          minPrice: minActivePrice(variants),
        },
      });
    });
    return this.get(scope, id);
  }

  async setStatus(id: string, status: ProductStatus): Promise<ManagedProduct> {
    await this.prisma.product.update({ where: { id }, data: { status } });
    return this.get({}, id);
  }

  async updateStock(scope: ProductScope, input: UpdateStockInput): Promise<void> {
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: input.items.map((i) => i.variantId) }, product: this.scopeWhere(scope) },
      select: { id: true },
    });
    if (variants.length !== input.items.length) throw new BadRequestException('Some variants were not found');
    await this.prisma.$transaction(
      input.items.map((i) =>
        this.prisma.productVariant.update({ where: { id: i.variantId }, data: { stock: i.stock } }),
      ),
    );
  }

  async remove(scope: ProductScope, id: string): Promise<{ deleted: boolean }> {
    const product = await this.prisma.product.findFirst({
      where: { id, ...this.scopeWhere(scope) },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product._count.orderItems > 0) {
      await this.prisma.product.update({ where: { id }, data: { status: 'INACTIVE' } });
      return { deleted: false };
    }
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }
}
