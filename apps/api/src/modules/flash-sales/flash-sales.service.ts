import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FlashSalePayload, FlashSaleItemPayload, FlashSaleView } from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { variantLabel } from '../../common/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';
import { type FlashMap, productCardInclude, toProductCard } from '../products/product.mapper.js';

type Db = PrismaService | Prisma.TransactionClient;

const flashSaleInclude = {
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { variant: { include: { product: { include: productCardInclude } } } },
  },
} satisfies Prisma.FlashSaleInclude;

type FlashSaleWithItems = Prisma.FlashSaleGetPayload<{ include: typeof flashSaleInclude }>;

@Injectable()
export class FlashSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: PlatformModeService,
  ) {}

  /** Active flash prices for the given variants (only sales running right now). */
  async priceMap(variantIds: string[], db: Db = this.prisma, now = new Date()): Promise<FlashMap> {
    if (variantIds.length === 0) return new Map();
    const items = await db.flashSaleItem.findMany({
      where: {
        variantId: { in: variantIds },
        flashSale: { isActive: true, startAt: { lte: now }, endAt: { gt: now } },
      },
      include: { flashSale: { select: { endAt: true } } },
      orderBy: { specialPrice: 'asc' },
    });
    const map: FlashMap = new Map();
    for (const item of items) {
      if (map.has(item.variantId)) continue;
      map.set(item.variantId, {
        flashSaleId: item.flashSaleId,
        specialPrice: item.specialPrice,
        stockLimit: item.stockLimit,
        soldCount: item.soldCount,
        endsAt: item.flashSale.endAt.toISOString(),
      });
    }
    return map;
  }

  private async toView(sale: FlashSaleWithItems, storefront: boolean): Promise<FlashSaleView> {
    const multiVendor = await this.mode.isMultiVendor();
    const now = new Date();
    const live = sale.isActive && sale.startAt <= now && sale.endAt > now;
    const flash: FlashMap = new Map(
      live
        ? sale.items.map((i) => [
            i.variantId,
            {
              flashSaleId: sale.id,
              specialPrice: i.specialPrice,
              stockLimit: i.stockLimit,
              soldCount: i.soldCount,
              endsAt: sale.endAt.toISOString(),
            },
          ])
        : [],
    );
    const items = sale.items.filter((i) => {
      if (!storefront) return true;
      const product = i.variant.product;
      return (
        product.status === 'ACTIVE' && i.variant.isActive && this.mode.isSellerVisible(product.seller, multiVendor)
      );
    });
    return {
      id: sale.id,
      title: sale.title,
      titleBn: sale.titleBn,
      startAt: sale.startAt.toISOString(),
      endAt: sale.endAt.toISOString(),
      isActive: sale.isActive,
      items: items.map((i) => {
        const card = toProductCard({ ...i.variant.product, variants: [i.variant] }, flash, multiVendor);
        return {
          id: i.id,
          variantId: i.variantId,
          specialPrice: i.specialPrice,
          stockLimit: i.stockLimit,
          soldCount: i.soldCount,
          sortOrder: i.sortOrder,
          product: card,
          variantLabel: variantLabel(i.variant.attributes),
          regularPrice: i.variant.price,
        };
      }),
    };
  }

  /** The flash sale running now (or null). */
  async active(): Promise<FlashSaleView | null> {
    const now = new Date();
    const sale = await this.prisma.flashSale.findFirst({
      where: { isActive: true, startAt: { lte: now }, endAt: { gt: now } },
      orderBy: { endAt: 'asc' },
      include: flashSaleInclude,
    });
    return sale ? this.toView(sale, true) : null;
  }

  // ───── Admin ─────

  async list(): Promise<FlashSaleView[]> {
    const sales = await this.prisma.flashSale.findMany({ orderBy: { startAt: 'desc' }, include: flashSaleInclude });
    return Promise.all(sales.map((s) => this.toView(s, false)));
  }

  async get(id: string): Promise<FlashSaleView> {
    const sale = await this.prisma.flashSale.findUnique({ where: { id }, include: flashSaleInclude });
    if (!sale) throw new NotFoundException('Flash sale not found');
    return this.toView(sale, false);
  }

  private async validateItems(items: FlashSaleItemPayload[]): Promise<void> {
    const ids = items.map((i) => i.variantId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each variant can appear only once');
    const variants = await this.prisma.productVariant.findMany({ where: { id: { in: ids } } });
    const byId = new Map(variants.map((v) => [v.id, v]));
    for (const item of items) {
      const v = byId.get(item.variantId);
      if (!v) throw new BadRequestException(`Variant ${item.variantId} not found`);
      if (item.specialPrice >= v.price) {
        throw new BadRequestException(`Flash price for ${v.sku} must be lower than its regular price`);
      }
    }
  }

  async create(input: FlashSalePayload): Promise<FlashSaleView> {
    const items = input.items ?? [];
    await this.validateItems(items);
    const sale = await this.prisma.flashSale.create({
      data: {
        title: input.title,
        titleBn: input.titleBn,
        startAt: new Date(input.startAt as Date),
        endAt: new Date(input.endAt as Date),
        isActive: input.isActive ?? true,
        items: {
          create: items.map((i, idx) => ({
            variantId: i.variantId,
            specialPrice: i.specialPrice,
            stockLimit: Number(i.stockLimit),
            sortOrder: Number(i.sortOrder ?? idx),
          })),
        },
      },
    });
    return this.get(sale.id);
  }

  /** Replaces sale fields and items. Sold counts are preserved for variants that stay in the sale. */
  async update(id: string, input: FlashSalePayload): Promise<FlashSaleView> {
    const items = input.items ?? [];
    await this.validateItems(items);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.flashSaleItem.findMany({ where: { flashSaleId: id } });
      const keep = new Set(items.map((i) => i.variantId));
      await tx.flashSaleItem.deleteMany({
        where: { flashSaleId: id, variantId: { notIn: [...keep] }, orderItems: { none: {} } },
      });
      await tx.flashSale.update({
        where: { id },
        data: {
          title: input.title,
          titleBn: input.titleBn,
          startAt: new Date(input.startAt as Date),
          endAt: new Date(input.endAt as Date),
          isActive: input.isActive ?? true,
        },
      });
      for (const [idx, item] of items.entries()) {
        const prev = existing.find((e) => e.variantId === item.variantId);
        const stockLimit = Math.max(Number(item.stockLimit), prev?.soldCount ?? 0);
        await tx.flashSaleItem.upsert({
          where: { flashSaleId_variantId: { flashSaleId: id, variantId: item.variantId } },
          update: { specialPrice: item.specialPrice, stockLimit, sortOrder: Number(item.sortOrder ?? idx) },
          create: {
            flashSaleId: id,
            variantId: item.variantId,
            specialPrice: item.specialPrice,
            stockLimit,
            sortOrder: Number(item.sortOrder ?? idx),
          },
        });
      }
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const used = await this.prisma.orderItem.count({ where: { flashSaleItem: { flashSaleId: id } } });
    if (used > 0) {
      await this.prisma.flashSale.update({ where: { id }, data: { isActive: false } });
      return;
    }
    await this.prisma.flashSale.delete({ where: { id } });
  }
}
