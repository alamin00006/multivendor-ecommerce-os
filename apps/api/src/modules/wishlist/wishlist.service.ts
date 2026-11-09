import { Injectable, NotFoundException } from '@nestjs/common';
import type { WishlistItemView } from '@marketbd/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';
import { ProductsService } from '../products/products.service.js';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: PlatformModeService,
    private readonly products: ProductsService,
  ) {}

  /** Wishlist entries whose products are currently visible (hidden ones are kept, not deleted). */
  async list(userId: string): Promise<WishlistItemView[]> {
    const rows = await this.prisma.wishlist.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const cards = await this.products.cardsByIds(rows.map((r) => r.productId));
    const byId = new Map(cards.map((c) => [c.id, c]));
    return rows.flatMap((r) => {
      const product = byId.get(r.productId);
      return product ? [{ product, addedAt: r.createdAt.toISOString() }] : [];
    });
  }

  async ids(userId: string): Promise<string[]> {
    const rows = await this.prisma.wishlist.findMany({ where: { userId }, select: { productId: true } });
    return rows.map((r) => r.productId);
  }

  async add(userId: string, productId: string): Promise<string[]> {
    const product = await this.prisma.product.findFirst({
      where: { AND: [{ id: productId }, await this.mode.visibleProductWhere()] },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.wishlist.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
    return this.ids(userId);
  }

  async remove(userId: string, productId: string): Promise<string[]> {
    await this.prisma.wishlist.deleteMany({ where: { userId, productId } });
    return this.ids(userId);
  }
}
