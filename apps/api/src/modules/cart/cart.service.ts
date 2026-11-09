import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AddToCartPayload,
  CART,
  type CartView,
  type MergeCartPayload,
  type UpdateCartItemInput,
} from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FlashSalesService } from '../flash-sales/flash-sales.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';
import { buildCartView, type CartLine, cartLineInclude, type PricingContext } from './cart-pricing.js';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: PlatformModeService,
    private readonly flashSales: FlashSalesService,
  ) {}

  private async cartId(userId: string): Promise<string> {
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });
    return cart.id;
  }

  async lines(userId: string, db: Db = this.prisma): Promise<CartLine[]> {
    return db.cartItem.findMany({
      where: { cart: { userId } },
      include: cartLineInclude,
      orderBy: { addedAt: 'desc' },
    });
  }

  async pricingContext(lines: CartLine[], db: Db = this.prisma): Promise<PricingContext> {
    const [flash, multiVendor] = await Promise.all([
      this.flashSales.priceMap(
        lines.map((l) => l.variantId),
        db,
      ),
      this.mode.isMultiVendor(),
    ]);
    return { flash, multiVendor };
  }

  async view(userId: string): Promise<CartView> {
    const lines = await this.lines(userId);
    return buildCartView(lines, await this.pricingContext(lines));
  }

  private async assertPurchasable(variantId: string, quantity: number): Promise<void> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { include: { seller: true } } },
    });
    const multiVendor = await this.mode.isMultiVendor();
    if (
      !variant ||
      !variant.isActive ||
      variant.product.status !== 'ACTIVE' ||
      !this.mode.isSellerVisible(variant.product.seller, multiVendor)
    ) {
      throw new NotFoundException('This product is not available');
    }
    if (variant.stock <= 0) throw new BadRequestException('This item is out of stock');
    if (quantity > variant.stock) throw new BadRequestException(`Only ${variant.stock} left in stock`);
  }

  async add(userId: string, input: AddToCartPayload): Promise<CartView> {
    const cartId = await this.cartId(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId: input.variantId } },
    });
    const quantity = Math.min((existing?.quantity ?? 0) + Number(input.quantity ?? 1), CART.maxQuantityPerItem);
    await this.assertPurchasable(input.variantId, quantity);
    if (!existing && (await this.prisma.cartItem.count({ where: { cartId } })) >= CART.maxItems) {
      throw new BadRequestException(`Your cart can hold up to ${CART.maxItems} items`);
    }
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId: input.variantId } },
      update: { quantity, selected: true },
      create: { cartId, variantId: input.variantId, quantity },
    });
    return this.view(userId);
  }

  async update(userId: string, itemId: string, input: UpdateCartItemInput): Promise<CartView> {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } } });
    if (!item) throw new NotFoundException('Cart item not found');
    if (input.quantity !== undefined && input.quantity > item.quantity) {
      await this.assertPurchasable(item.variantId, input.quantity);
    }
    await this.prisma.cartItem.update({ where: { id: itemId }, data: input });
    return this.view(userId);
  }

  async remove(userId: string, itemId: string): Promise<CartView> {
    const { count } = await this.prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
    if (count === 0) throw new NotFoundException('Cart item not found');
    return this.view(userId);
  }

  async selectAll(userId: string, selected: boolean): Promise<CartView> {
    await this.prisma.cartItem.updateMany({ where: { cart: { userId } }, data: { selected } });
    return this.view(userId);
  }

  async clearUnavailable(userId: string): Promise<CartView> {
    const lines = await this.lines(userId);
    const view = buildCartView(lines, await this.pricingContext(lines));
    const ids = view.items.filter((i) => !i.available).map((i) => i.id);
    await this.prisma.cartItem.deleteMany({ where: { id: { in: ids } } });
    return this.view(userId);
  }

  /** Merges a guest (local storage) cart after login. Unavailable items are skipped silently. */
  async merge(userId: string, input: MergeCartPayload): Promise<CartView> {
    const cartId = await this.cartId(userId);
    const multiVendor = await this.mode.isMultiVendor();
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: input.items.map((i) => i.variantId) } },
      include: { product: { include: { seller: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    for (const item of input.items) {
      const v = byId.get(item.variantId);
      if (!v || !v.isActive || v.stock <= 0 || v.product.status !== 'ACTIVE') continue;
      if (!this.mode.isSellerVisible(v.product.seller, multiVendor)) continue;
      const existing = await this.prisma.cartItem.findUnique({
        where: { cartId_variantId: { cartId, variantId: v.id } },
      });
      const quantity = Math.min(
        (existing?.quantity ?? 0) + Number(item.quantity ?? 1),
        v.stock,
        CART.maxQuantityPerItem,
      );
      await this.prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId, variantId: v.id } },
        update: { quantity },
        create: { cartId, variantId: v.id, quantity },
      });
    }
    return this.view(userId);
  }

  async count(userId: string): Promise<{ count: number }> {
    const agg = await this.prisma.cartItem.aggregate({ where: { cart: { userId } }, _sum: { quantity: true } });
    return { count: agg._sum.quantity ?? 0 };
  }
}
