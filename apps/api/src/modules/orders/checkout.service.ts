import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  type CartItemView,
  type CheckoutGroup,
  type CheckoutPayload,
  type CheckoutPreview,
  type CheckoutPreviewInput,
  type PaymentInitResult,
  type PlaceOrderResult,
  type ShippingZone,
} from '@marketbd/shared';
import { generateOrderNumber, num, variantLabel } from '../../common/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { addressInclude, AddressesService } from '../addresses/addresses.service.js';
import { type CartLine, toCartItemView } from '../cart/cart-pricing.js';
import { CartService } from '../cart/cart.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { OwnDeliveryService, type ShopDelivery } from '../own-delivery/own-delivery.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { toSellerSummary } from '../products/product.mapper.js';
import { commissionFor } from './commission.js';
import { orderSummaryInclude, toOrderSummary } from './order.mapper.js';

interface PricedGroup {
  sellerId: string;
  commissionRate: number;
  lines: Array<{ line: CartLine; view: CartItemView }>;
  subtotal: number;
  shippingFee: number;
  delivery?: ShopDelivery;
}

/** Shop names whose own-courier COD is paused (they owe too much commission). */
const codPausedShops = (groups: PricedGroup[]) =>
  groups.filter((g) => g.delivery?.own && g.delivery.codPaused).map((g) => g.lines[0]!.line.variant.product.seller.shopName);

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger('Checkout');

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly addresses: AddressesService,
    private readonly coupons: CouponsService,
    private readonly payments: PaymentsService,
    private readonly mode: PlatformModeService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly ownDelivery: OwnDeliveryService,
  ) {}

  /** Each shop's delivery: its own courier and fee when approved, otherwise MarketBD Delivery. */
  private async applyDelivery(groups: PricedGroup[], zone: ShippingZone | null, platformFee: number): Promise<void> {
    const map = await this.ownDelivery.forCheckout(
      groups.map((g) => g.sellerId),
      zone,
      platformFee,
    );
    for (const g of groups) {
      g.delivery = map.get(g.sellerId);
      if (g.delivery) g.shippingFee = g.delivery.fee;
    }
  }

  /** Groups selected cart lines by seller. In single-vendor mode there is exactly one group. */
  /** shippingFee: per-package delivery fee in poisha (from Admin → Settings). */
  private group(lines: CartLine[], views: CartItemView[], shippingFee: number): PricedGroup[] {
    const groups = new Map<string, PricedGroup>();
    lines.forEach((line, i) => {
      const view = views[i];
      if (!view) return;
      const seller = line.variant.product.seller;
      const g = groups.get(seller.id) ?? {
        sellerId: seller.id,
        commissionRate: 0,
        lines: [],
        subtotal: 0,
        shippingFee,
      };
      g.lines.push({ line, view });
      g.subtotal += view.lineTotal;
      groups.set(seller.id, g);
    });
    return [...groups.values()];
  }

  async preview(userId: string, input: CheckoutPreviewInput): Promise<CheckoutPreview> {
    const all = await this.cart.lines(userId);
    const ctx = await this.cart.pricingContext(all);
    const selected = all.filter((l) => l.selected);
    const views = selected.map((l) => toCartItemView(l, ctx));
    const availableIdx = views.map((v, i) => (v.available ? i : -1)).filter((i) => i >= 0);
    const lines = availableIdx.map((i) => selected[i] as CartLine);
    const okViews = availableIdx.map((i) => views[i] as CartItemView);

    let zone: ShippingZone | null = null;
    if (input.addressId) {
      zone = (await this.addresses.findOwned(userId, input.addressId)).area.isInsideDhaka
        ? 'INSIDE_DHAKA'
        : 'OUTSIDE_DHAKA';
    } else {
      const def = await this.prisma.address.findFirst({ where: { userId, isDefault: true }, include: addressInclude });
      if (def) zone = def.area.isInsideDhaka ? 'INSIDE_DHAKA' : 'OUTSIDE_DHAKA';
    }

    const platformFee = await this.settings.shippingFee(zone);
    const groups = this.group(lines, okViews, platformFee);
    await this.applyDelivery(groups, zone, platformFee);
    const subtotal = groups.reduce((s, g) => s + g.subtotal, 0);
    const shippingFee = groups.reduce((s, g) => s + g.shippingFee, 0);
    let discount = 0;
    let coupon: CheckoutPreview['coupon'] = null;
    let couponError: string | null = null;
    if (input.couponCode && subtotal > 0) {
      const check = await this.coupons.check(input.couponCode, userId, {
        groups: groups.map((g) => ({ sellerId: g.sellerId, subtotal: g.subtotal, shippingFee: g.shippingFee })),
        paymentMethod: input.paymentMethod,
      });
      if ('error' in check) couponError = check.error;
      else {
        discount = check.result.discount;
        coupon = { code: check.coupon.code, discount, appliesTo: check.result.appliesTo };
      }
    }
    const checkoutGroups: CheckoutGroup[] = groups.map((g) => ({
      seller: ctx.multiVendor ? toSellerSummary(g.lines[0]!.line.variant.product.seller) : null,
      items: g.lines.map((l) => l.view),
      subtotal: g.subtotal,
      shippingFee: g.shippingFee,
      delivery: g.delivery?.own
        ? { by: 'SHOP' as const, courier: g.delivery.courier, eta: g.delivery.eta }
        : { by: 'PLATFORM' as const, courier: null, eta: g.delivery?.eta ?? null },
    }));
    const paused = codPausedShops(groups);
    return {
      groups: checkoutGroups,
      shippingZone: zone,
      subtotal,
      shippingFee,
      discount,
      total: Math.max(0, subtotal + shippingFee - discount),
      coupon,
      couponError,
      blockedItems: views.length - okViews.length,
      paymentMethods: this.payments.methods().map((m) =>
        m.method === 'COD' && paused.length
          ? { ...m, enabled: false, note: `Not available for items from ${paused.join(', ')} right now. Pay online to order them.` }
          : m,
      ),
    };
  }

  async place(userId: string, input: CheckoutPayload): Promise<PlaceOrderResult> {
    this.payments.assertMethodEnabled(input.paymentMethod);
    const address = await this.addresses.findOwned(userId, input.addressId);
    const zone: ShippingZone = address.area.isInsideDhaka ? 'INSIDE_DHAKA' : 'OUTSIDE_DHAKA';
    const multiVendor = await this.mode.isMultiVendor();

    const order = await this.prisma.$transaction(
      async (tx) => {
        const lines = (await this.cart.lines(userId, tx)).filter((l) => l.selected);
        if (lines.length === 0) throw new BadRequestException('Select at least one item to check out');
        const ctx = await this.cart.pricingContext(lines, tx);
        const views = lines.map((l) => toCartItemView(l, ctx));
        const blocked = views.filter((v) => !v.available);
        if (blocked.length) {
          throw new BadRequestException(
            `${blocked.length} item(s) in your cart are unavailable. Remove them or update quantities to continue.`,
          );
        }

        const platformFee = await this.settings.shippingFee(zone);
        const groups = this.group(lines, views, platformFee);
        await this.applyDelivery(groups, zone, platformFee);
        const paused = codPausedShops(groups);
        if (input.paymentMethod === 'COD' && paused.length) {
          throw new BadRequestException(`Cash on Delivery is not available for items from ${paused.join(', ')} right now. Please pay online.`);
        }
        const sellers = await tx.sellerProfile.findMany({ where: { id: { in: groups.map((g) => g.sellerId) } } });
        for (const g of groups) g.commissionRate = num(sellers.find((s) => s.id === g.sellerId)?.commissionRate);

        const subtotal = groups.reduce((s, g) => s + g.subtotal, 0);
        const shippingFee = groups.reduce((s, g) => s + g.shippingFee, 0);
        let discount = 0;
        let couponId: string | null = null;
        let discounts = groups.map(() => 0);
        // Delivery-fee vouchers do not reduce the item value sellers pay commission on.
        let itemsDiscounted = true;
        if (input.couponCode) {
          const check = await this.coupons.check(
            input.couponCode,
            userId,
            {
              groups: groups.map((g) => ({ sellerId: g.sellerId, subtotal: g.subtotal, shippingFee: g.shippingFee })),
              paymentMethod: input.paymentMethod,
            },
            tx,
          );
          if ('error' in check) throw new BadRequestException(check.error);
          discount = check.result.discount;
          discounts = check.result.allocation;
          itemsDiscounted = check.result.appliesTo === 'items';
          couponId = check.coupon.id;
        }

        // Reserve stock (and flash allocation) atomically; any shortfall aborts the transaction.
        const flashItemIds = new Map<string, string>();
        for (const { line, view } of groups.flatMap((g) => g.lines)) {
          const { count } = await tx.productVariant.updateMany({
            where: { id: line.variantId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (count === 0) throw new ConflictException(`"${view.product.title}" just went out of stock`);
          await tx.product.update({
            where: { id: view.product.id },
            data: { soldCount: { increment: line.quantity } },
          });
          if (view.isFlashPrice) {
            const flashSaleId = ctx.flash.get(line.variantId)?.flashSaleId;
            const rows = await tx.$queryRaw<Array<{ id: string }>>`
              UPDATE "FlashSaleItem" SET "soldCount" = "soldCount" + ${line.quantity}
              WHERE "flashSaleId" = ${flashSaleId} AND "variantId" = ${line.variantId}
                AND "soldCount" + ${line.quantity} <= "stockLimit"
              RETURNING id`;
            const id = rows[0]?.id;
            if (!id)
              throw new ConflictException(
                `Flash deal for "${view.product.title}" just sold out. Please review your cart.`,
              );
            flashItemIds.set(line.variantId, id);
          }
        }

        const total = Math.max(0, subtotal + shippingFee - discount);
        const created = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId,
            status: 'PENDING',
            paymentMethod: input.paymentMethod,
            paymentStatus: input.paymentMethod === 'COD' ? 'UNPAID' : 'PENDING',
            shippingZone: zone,
            shippingAddress: {
              fullName: address.fullName,
              phone: address.phone,
              addressLine: address.addressLine,
              landmark: address.landmark,
              area: address.area.name,
              district: address.district.name,
              division: address.division.name,
            },
            subtotal,
            shippingFee,
            discount,
            total,
            couponId,
            couponCode: couponId ? input.couponCode?.toUpperCase() : null,
            note: input.note,
          },
        });
        await tx.orderStatusHistory.create({
          data: { orderId: created.id, toStatus: 'PENDING', note: 'Order placed', actorId: userId },
        });

        for (const [gi, g] of groups.entries()) {
          const groupDiscount = discounts[gi] ?? 0;
          const commissionBase = Math.max(0, g.subtotal - (itemsDiscounted ? groupDiscount : 0));
          const commission = await commissionFor(
            tx,
            g.commissionRate,
            g.lines.map(({ view }) => ({ productId: view.product.id, amount: view.lineTotal })),
            commissionBase,
          );
          const sub = await tx.subOrder.create({
            data: {
              orderId: created.id,
              sellerId: g.sellerId,
              status: 'PENDING',
              subtotal: g.subtotal,
              shippingFee: g.shippingFee,
              discount: groupDiscount,
              total: g.subtotal + g.shippingFee - groupDiscount,
              commissionRate: commission.rate,
              commissionAmount: commission.amount,
              fulfillment: g.delivery?.own ? 'SELLER' : 'PLATFORM',
              courierName: g.delivery?.own ? g.delivery.courier : null,
              sellerCollectsCash: Boolean(g.delivery?.own) && input.paymentMethod === 'COD',
            },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: created.id,
              subOrderId: sub.id,
              toStatus: 'PENDING',
              note: 'Order placed',
              actorId: userId,
            },
          });
          await tx.orderItem.createMany({
            data: g.lines.map(({ line, view }) => ({
              orderId: created.id,
              subOrderId: sub.id,
              productId: view.product.id,
              variantId: line.variantId,
              title: view.product.title,
              variantLabel: variantLabel(line.variant.attributes),
              sku: line.variant.sku,
              imageUrl: view.product.imageUrl,
              unitPrice: view.unitPrice,
              quantity: line.quantity,
              lineTotal: view.lineTotal,
              flashSaleItemId: flashItemIds.get(line.variantId) ?? null,
            })),
          });
        }

        await this.payments.createForOrder(tx, created, input.client);
        if (couponId) await this.coupons.redeem(tx, couponId, userId, created.id);
        await tx.cartItem.deleteMany({ where: { id: { in: lines.map((l) => l.id) } } });

        if (multiVendor) {
          const owners = await tx.sellerProfile.findMany({
            where: { id: { in: groups.map((g) => g.sellerId) } },
            select: { userId: true },
          });
          for (const o of owners) {
            await tx.notification.create({
              data: {
                userId: o.userId,
                type: 'ORDER',
                title: 'New order',
                body: `You received a new order ${created.orderNumber}.`,
                data: { orderId: created.id },
              },
            });
          }
        }
        return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: orderSummaryInclude });
      },
      { timeout: 20_000, isolationLevel: 'ReadCommitted' },
    );

    await this.notifications.notify(
      userId,
      'ORDER',
      'Order placed',
      `Your order ${order.orderNumber} has been placed successfully.`,
      { orderId: order.id },
    );

    let payment: PaymentInitResult | null = null;
    if (input.paymentMethod !== 'COD') {
      try {
        payment = await this.payments.initiate(userId, order.id, input.client);
      } catch (error) {
        this.logger.warn(`Payment initiation failed for ${order.orderNumber}: ${String(error)}`);
      }
    }
    return { order: toOrderSummary(order), payment };
  }
}
