import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BRAND, type PosProduct, type PosProductQuery, type PosSalePayload, type PosSaleResult } from '@marketbd/shared';
import type { SellerProfile } from '../../generated/prisma/client.js';
import { generateOrderNumber, num, variantLabel } from '../../common/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';
import { commissionFor } from '../orders/commission.js';

/** Placeholder account that owns counter sales made to customers without a MarketBD account. */
export const WALK_IN_EMAIL = 'walk-in@pos.marketbd.local';
const WALK_IN_NAME = 'Walk-in customer';

/**
 * Point of sale for the house store's counter. Sales are cash only for now: each one is saved as an
 * already delivered and paid order (channel POS) so stock, reports and the customer's history stay in step.
 */
@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SellerAccessService,
    private readonly orders: OrdersService,
    private readonly settings: SettingsService,
  ) {}

  /** The admin counter sells for the house store; a seller's counter sells for their own shop. */
  async shopFor(actor: { id: string; role: string }): Promise<SellerProfile> {
    return actor.role === 'ADMIN' ? this.access.houseStore() : this.access.requireActiveSeller(actor.id);
  }

  private async header(shop: SellerProfile): Promise<PosSaleResult['shop']> {
    if (shop.isHouseStore) {
      const store = (await this.settings.publicSettings()).store;
      return { name: BRAND.name, phone: store.phone || BRAND.supportPhone, address: store.address || null };
    }
    return { name: shop.shopName, phone: shop.phone, address: shop.pickupAddress };
  }

  /** The shop's products matching a title or SKU (an exact SKU scan ranks first). */
  async products(house: SellerProfile, query: PosProductQuery): Promise<PosProduct[]> {
    const q = query.q?.trim();
    const rows = await this.prisma.product.findMany({
      where: {
        sellerId: house.id,
        status: 'ACTIVE',
        variants: { some: { isActive: true } },
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { variants: { some: { isActive: true, sku: { contains: q, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      include: {
        brand: { select: { name: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        variants: { where: { isActive: true }, orderBy: { price: 'asc' } },
      },
      orderBy: [{ soldCount: 'desc' }, { title: 'asc' }],
      take: query.limit,
    });
    const exact = q?.toUpperCase();
    const list = rows.map<PosProduct>((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      imageUrl: p.images[0]?.url ?? null,
      brand: p.brand?.name ?? null,
      variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, label: variantLabel(v.attributes), price: v.price, stock: v.stock })),
    }));
    return exact ? [...list].sort((a, b) => Number(b.variants.some((v) => v.sku.toUpperCase() === exact)) - Number(a.variants.some((v) => v.sku.toUpperCase() === exact))) : list;
  }

  async sell(cashierId: string, house: SellerProfile, input: PosSalePayload): Promise<PosSaleResult> {
    const cashier = await this.prisma.user.findUniqueOrThrow({ where: { id: cashierId }, select: { name: true } });
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: input.items.map((i) => i.variantId) } },
      include: { product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } } },
    });

    const lines = input.items.map((item) => {
      const v = variants.find((x) => x.id === item.variantId);
      if (!v || !v.isActive || v.product.status !== 'ACTIVE') throw new NotFoundException('One of the items is no longer for sale');
      if (v.product.sellerId !== house.id) throw new BadRequestException(`"${v.product.title}" is not a product of this shop`);
      if (v.stock < item.quantity) throw new ConflictException(`Only ${v.stock} left of "${v.product.title}" (${v.sku})`);
      return { v, quantity: item.quantity, lineTotal: v.price * item.quantity };
    });

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    if (input.discount > subtotal) throw new BadRequestException('Discount cannot be more than the subtotal');
    const total = subtotal - input.discount;
    if (input.cashReceived < total) throw new BadRequestException(`Cash received is less than the total (৳${(total / 100).toLocaleString('en-US')})`);

    const customer = input.customerPhone
      ? await this.prisma.user.findUnique({ where: { phone: input.customerPhone }, select: { id: true, name: true, phone: true, role: true } })
      : null;
    const linked = customer?.role === 'CUSTOMER' ? customer : null;
    const ownerId = linked?.id ?? (await this.walkInUserId());
    const rate = num(house.commissionRate);

    const orderId = await this.prisma.$transaction(
      async (tx) => {
        for (const l of lines) {
          const { count } = await tx.productVariant.updateMany({
            where: { id: l.v.id, stock: { gte: l.quantity } },
            data: { stock: { decrement: l.quantity } },
          });
          if (count === 0) throw new ConflictException(`"${l.v.product.title}" just went out of stock`);
          await tx.product.update({ where: { id: l.v.productId }, data: { soldCount: { increment: l.quantity } } });
        }

        const now = new Date();
        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(now),
            userId: ownerId,
            channel: 'POS',
            status: 'DELIVERED',
            paymentMethod: 'CASH',
            paymentStatus: 'PAID',
            shippingZone: 'INSIDE_DHAKA',
            shippingAddress: {
              fullName: linked?.name ?? (input.customerName || WALK_IN_NAME),
              phone: input.customerPhone ?? '',
              addressLine: `Store counter — ${house.shopName}`,
              landmark: null,
              area: 'Counter sale',
              district: '',
              division: '',
            },
            subtotal,
            shippingFee: 0,
            discount: input.discount,
            total,
            note: input.note,
          },
        });
        const commission = await commissionFor(
          tx,
          rate,
          lines.map((l) => ({ productId: l.v.productId, amount: l.lineTotal })),
          total,
        );
        const sub = await tx.subOrder.create({
          data: {
            orderId: order.id,
            sellerId: house.id,
            status: 'DELIVERED',
            subtotal,
            shippingFee: 0,
            discount: input.discount,
            total,
            commissionRate: commission.rate,
            commissionAmount: commission.amount,
          },
        });
        const note = `Sold at the counter by ${cashier.name}`;
        await tx.orderStatusHistory.createMany({
          data: [
            { orderId: order.id, toStatus: 'DELIVERED', note, actorId: cashierId },
            { orderId: order.id, subOrderId: sub.id, toStatus: 'DELIVERED', note, actorId: cashierId },
          ],
        });
        await tx.orderItem.createMany({
          data: lines.map((l) => ({
            orderId: order.id,
            subOrderId: sub.id,
            productId: l.v.productId,
            variantId: l.v.id,
            title: l.v.product.title,
            variantLabel: variantLabel(l.v.attributes),
            sku: l.v.sku,
            imageUrl: l.v.product.images[0]?.url ?? null,
            unitPrice: l.v.price,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
          })),
        });
        await tx.payment.create({
          data: {
            orderId: order.id,
            method: 'CASH',
            status: 'PAID',
            amount: total,
            paidAt: now,
            rawResponse: { cashReceived: input.cashReceived, change: input.cashReceived - total, cashierId },
          },
        });
        return order.id;
      },
      { timeout: 20_000, isolationLevel: 'ReadCommitted' },
    );

    return {
      order: await this.orders.getAny(orderId),
      cashReceived: input.cashReceived,
      change: input.cashReceived - total,
      customer: linked ? { id: linked.id, name: linked.name, phone: linked.phone } : null,
      cashier: cashier.name,
      shop: await this.header(house),
    };
  }

  /** Receipt for an earlier counter sale (reprint). */
  async receipt(shop: SellerProfile, orderId: string): Promise<PosSaleResult> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, channel: 'POS', subOrders: { some: { sellerId: shop.id } } },
      include: { user: { select: { id: true, name: true, phone: true, email: true } }, payments: { take: 1, orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Counter sale not found');
    const raw = (order.payments[0]?.rawResponse ?? {}) as { cashReceived?: number; change?: number; cashierId?: string };
    const cashier = raw.cashierId ? await this.prisma.user.findUnique({ where: { id: raw.cashierId }, select: { name: true } }) : null;
    const walkIn = order.user.email === WALK_IN_EMAIL;
    return {
      order: await this.orders.getAny(order.id),
      cashReceived: raw.cashReceived ?? order.total,
      change: raw.change ?? 0,
      customer: walkIn ? null : { id: order.user.id, name: order.user.name, phone: order.user.phone },
      cashier: cashier?.name ?? '—',
      shop: await this.header(shop),
    };
  }

  private async walkInUserId(): Promise<string> {
    const user = await this.prisma.user.upsert({
      where: { email: WALK_IN_EMAIL },
      update: {},
      // Inactive with no password: it can never sign in.
      create: { email: WALK_IN_EMAIL, name: WALK_IN_NAME, isActive: false },
      select: { id: true },
    });
    return user.id;
  }
}
