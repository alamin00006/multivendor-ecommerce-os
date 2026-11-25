import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type DeliveryDisputeInput,
  type OpenDisputeView,
  ownCourierName,
  type OwnDeliveryDecisionInput,
  type OwnDeliveryPayload,
  type OwnDeliverySettingsView,
  type OwnDeliveryShopView,
  type OwnDeliveryView,
  type ResolveDisputeInput,
  type SellerAdjustmentInput,
  type SellerAdjustmentView,
  type ShippingZone,
} from '@marketbd/shared';
import type { Prisma, SellerProfile } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PayoutsService } from '../payouts/payouts.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';

const DAY = 86_400_000;
const settingsOf = (s: Pick<SellerProfile, 'ownDelivery'>): OwnDeliverySettingsView | null => (s.ownDelivery as OwnDeliverySettingsView | null) ?? null;

/** How one shop's package is delivered at checkout. */
export interface ShopDelivery {
  own: boolean;
  fee: number;
  courier: string | null;
  eta: string | null;
  /** Own-courier COD paused because the shop owes too much commission. */
  codPaused: boolean;
}

/**
 * Shops that deliver with their own courier ("own delivery").
 * The shop sets its courier, fees and delivery times; admin approves before it is used at checkout.
 * COD cash on those packages goes to the shop, so the commission is taken from the shop's balance;
 * when the shop owes more than the admin's limit, COD is paused for its items until it pays.
 */
@Injectable()
export class OwnDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SellerAccessService,
    private readonly payouts: PayoutsService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  private async dueLimit(): Promise<number> {
    return (await this.settings.get()).ownDeliveryDueLimit;
  }

  private async view(seller: SellerProfile, limit?: number): Promise<OwnDeliveryView> {
    const [{ balance }, dueLimit] = await Promise.all([this.payouts.summaryFor(seller.id), limit ?? this.dueLimit()]);
    return {
      status: seller.ownDeliveryStatus,
      settings: settingsOf(seller),
      note: seller.ownDeliveryNote,
      updatedAt: seller.ownDeliveryUpdatedAt?.toISOString() ?? null,
      balance,
      dueLimit,
      codPaused: seller.ownDeliveryStatus === 'APPROVED' && balance < -dueLimit,
    };
  }

  private async adminIds(): Promise<string[]> {
    return (await this.prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })).map((u) => u.id);
  }

  // ───── Seller ─────

  async mine(userId: string): Promise<OwnDeliveryView> {
    return this.view(await this.access.requireActiveSeller(userId));
  }

  /** Save own-courier settings; they apply once admin approves them again. */
  async request(userId: string, input: OwnDeliveryPayload): Promise<OwnDeliveryView> {
    const seller = await this.access.requireActiveSeller(userId);
    if (seller.isHouseStore) throw new BadRequestException('The house store ships with MarketBD Delivery');
    const settings: OwnDeliverySettingsView = {
      courier: input.courier,
      courierName: input.courier === 'OTHER' ? (input.courierName ?? null) : null,
      insideDhakaFee: input.insideDhakaFee,
      outsideDhakaFee: input.outsideDhakaFee,
      insideDhakaEta: input.insideDhakaEta,
      outsideDhakaEta: input.outsideDhakaEta,
    };
    const updated = await this.prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { ownDelivery: settings as unknown as Prisma.InputJsonValue, ownDeliveryStatus: 'PENDING', ownDeliveryNote: null, ownDeliveryUpdatedAt: new Date() },
    });
    for (const id of await this.adminIds()) {
      await this.notifications.notify(id, 'SELLER', 'Own delivery request', `${seller.shopName} wants to deliver with ${ownCourierName(settings)}.`, { sellerId: seller.id });
    }
    return this.view(updated);
  }

  /** Back to MarketBD Delivery (takes effect for new orders right away). */
  async stop(userId: string): Promise<OwnDeliveryView> {
    const seller = await this.access.requireActiveSeller(userId);
    const updated = await this.prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { ownDeliveryStatus: null, ownDeliveryNote: null, ownDeliveryUpdatedAt: new Date() },
    });
    return this.view(updated);
  }

  // ───── Admin ─────

  async list(status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<OwnDeliveryShopView[]> {
    const sellers = await this.prisma.sellerProfile.findMany({
      where: status ? { ownDeliveryStatus: status } : { ownDeliveryStatus: { not: null } },
      orderBy: { ownDeliveryUpdatedAt: 'desc' },
    });
    const limit = await this.dueLimit();
    const out: OwnDeliveryShopView[] = [];
    for (const s of sellers) {
      const packages = await this.prisma.subOrder.findMany({
        where: { sellerId: s.id, fulfillment: 'SELLER' },
        select: {
          status: true,
          disputedAt: true,
          disputeResolution: true,
          history: { where: { toStatus: { in: ['SHIPPED', 'DELIVERED'] } }, select: { toStatus: true, createdAt: true } },
        },
      });
      const shipped = packages.filter((p) => p.history.some((h) => h.toStatus === 'SHIPPED'));
      const delivered = packages.filter((p) => p.history.some((h) => h.toStatus === 'DELIVERED'));
      const durations = delivered.flatMap((p) => {
        const a = p.history.find((h) => h.toStatus === 'SHIPPED')?.createdAt;
        const b = p.history.find((h) => h.toStatus === 'DELIVERED')?.createdAt;
        return a && b ? [(b.getTime() - a.getTime()) / DAY] : [];
      });
      out.push({
        ...(await this.view(s, limit)),
        seller: { id: s.id, shopName: s.shopName, slug: s.slug, phone: s.phone },
        stats: {
          shipped: shipped.length,
          delivered: delivered.length,
          returned: packages.filter((p) => p.status === 'RETURNED' || p.status === 'REFUNDED').length,
          avgDeliveryDays: durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null,
          openDisputes: packages.filter((p) => p.disputedAt && !p.disputeResolution).length,
          disputes: packages.filter((p) => p.disputedAt).length,
        },
      });
    }
    return out;
  }

  async decide(sellerId: string, input: OwnDeliveryDecisionInput): Promise<OwnDeliveryShopView> {
    const seller = await this.prisma.sellerProfile.findUnique({ where: { id: sellerId } });
    if (!seller || !seller.ownDeliveryStatus) throw new NotFoundException('No own-delivery request for this shop');
    if (input.action === 'APPROVE' && !seller.ownDelivery) throw new BadRequestException('The shop has not saved its courier settings');
    const status = input.action === 'APPROVE' ? 'APPROVED' : input.action === 'REJECT' ? 'REJECTED' : null;
    await this.prisma.sellerProfile.update({
      where: { id: sellerId },
      data: { ownDeliveryStatus: status, ownDeliveryNote: input.note ?? null, ownDeliveryUpdatedAt: new Date() },
    });
    const text =
      input.action === 'APPROVE'
        ? 'Your own courier was approved. New orders now use your delivery fees and courier.'
        : input.action === 'REJECT'
          ? `Your own delivery request was not approved: ${input.note}`
          : `Own delivery was switched off for your shop: ${input.note}. New orders use MarketBD Delivery.`;
    await this.notifications.notify(seller.userId, 'SELLER', 'Delivery method update', text);
    const row = (await this.list()).find((r) => r.seller.id === sellerId);
    if (row) return row;
    // Disabled shops leave the list; return their view directly.
    const fresh = await this.prisma.sellerProfile.findUniqueOrThrow({ where: { id: sellerId } });
    return { ...(await this.view(fresh)), seller: { id: fresh.id, shopName: fresh.shopName, slug: fresh.slug, phone: fresh.phone }, stats: { shipped: 0, delivered: 0, returned: 0, avgDeliveryDays: null, openDisputes: 0, disputes: 0 } };
  }

  async adjustments(sellerId: string): Promise<SellerAdjustmentView[]> {
    const rows = await this.prisma.sellerAdjustment.findMany({ where: { sellerId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map((a) => ({ id: a.id, amount: a.amount, note: a.note, reference: a.reference, createdAt: a.createdAt.toISOString() }));
  }

  /** Record money the shop paid to the platform (e.g. commission dues by bKash). */
  async addAdjustment(actorId: string, sellerId: string, input: SellerAdjustmentInput & { amount: number }): Promise<SellerAdjustmentView[]> {
    const seller = await this.prisma.sellerProfile.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Shop not found');
    await this.prisma.sellerAdjustment.create({ data: { sellerId, amount: input.amount, note: input.note, reference: input.reference, createdById: actorId } });
    const taka = `৳${(Math.abs(input.amount) / 100).toLocaleString('en-US')}`;
    await this.notifications.notify(
      seller.userId,
      'SELLER',
      input.amount > 0 ? 'Payment received' : 'Balance corrected',
      input.amount > 0 ? `MarketBD recorded ${taka} from your shop: ${input.note}` : `${taka} was taken from your balance: ${input.note}`,
    );
    return this.adjustments(sellerId);
  }

  async openDisputes(): Promise<OpenDisputeView[]> {
    const rows = await this.prisma.subOrder.findMany({
      where: { disputedAt: { not: null }, disputeResolution: null },
      include: { seller: { select: { shopName: true } }, order: { select: { id: true, orderNumber: true, shippingAddress: true, user: { select: { name: true, phone: true } } } } },
      orderBy: { disputedAt: 'asc' },
    });
    return rows.map((s) => ({
      orderId: s.order.id,
      orderNumber: s.order.orderNumber,
      subOrderId: s.id,
      shopName: s.seller.shopName,
      courierName: s.courierName,
      trackingNumber: s.trackingNumber,
      total: s.total,
      customer: { name: s.order.user.name, phone: s.order.user.phone },
      note: s.disputeNote ?? '',
      createdAt: s.disputedAt!.toISOString(),
    }));
  }

  // ───── Customer complaint: "I did not receive it" ─────

  async dispute(userId: string, orderId: string, subOrderId: string, input: DeliveryDisputeInput): Promise<void> {
    const sub = await this.prisma.subOrder.findFirst({
      where: { id: subOrderId, orderId, order: { userId } },
      include: { order: true, seller: true, history: { where: { toStatus: 'DELIVERED' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!sub) throw new NotFoundException('Package not found');
    if (sub.status !== 'DELIVERED') throw new BadRequestException('Only a package marked delivered can be reported');
    if (sub.disputedAt) throw new ConflictException('You already reported this package');
    const deliveredAt = sub.history[0]?.createdAt;
    const days = await this.settings.returnDays();
    if (!deliveredAt || Date.now() - deliveredAt.getTime() > Math.max(days, 7) * DAY) {
      throw new BadRequestException('It is too late to report this package. Please contact support.');
    }
    await this.prisma.subOrder.update({ where: { id: sub.id }, data: { disputeNote: input.note, disputedAt: new Date() } });
    const text = `Order ${sub.order.orderNumber}: the customer says the package was not received.`;
    for (const id of await this.adminIds()) await this.notifications.notify(id, 'ORDER', 'Delivery complaint', text, { orderId });
    await this.notifications.notify(sub.seller.userId, 'ORDER', 'Delivery complaint', `${text} MarketBD support will contact you.`, { orderId });
  }

  async resolve(orderId: string, subOrderId: string, input: ResolveDisputeInput): Promise<void> {
    const sub = await this.prisma.subOrder.findFirst({ where: { id: subOrderId, orderId }, include: { order: true, seller: true } });
    if (!sub || !sub.disputedAt) throw new NotFoundException('No complaint on this package');
    if (sub.disputeResolution) throw new ConflictException('This complaint was already resolved');
    await this.prisma.subOrder.update({ where: { id: sub.id }, data: { disputeResolution: input.resolution, disputeResolvedAt: new Date() } });
    const customer =
      input.resolution === 'NOT_DELIVERED'
        ? `We confirmed your package from order ${sub.order.orderNumber} was not delivered. Your refund will be processed.`
        : `We checked with the courier: your package from order ${sub.order.orderNumber} was delivered.${input.note ? ` ${input.note}` : ''}`;
    await this.notifications.notify(sub.order.userId, 'ORDER', 'Delivery complaint resolved', customer, { orderId });
    await this.notifications.notify(
      sub.seller.userId,
      'ORDER',
      'Delivery complaint resolved',
      input.resolution === 'NOT_DELIVERED'
        ? `Order ${sub.order.orderNumber} was found not delivered; it no longer counts towards your earnings.`
        : `Order ${sub.order.orderNumber} was confirmed as delivered.`,
      { orderId },
    );
  }

  // ───── Checkout ─────

  /** Delivery for each shop in the cart: own courier (when approved) or MarketBD Delivery. */
  async forCheckout(sellerIds: string[], zone: ShippingZone | null, platformFee: number): Promise<Map<string, ShopDelivery>> {
    const app = await this.settings.get();
    const platformEta = zone === 'OUTSIDE_DHAKA' ? app.deliveryOutsideDhaka : zone === 'INSIDE_DHAKA' ? app.deliveryInsideDhaka : null;
    const sellers = await this.prisma.sellerProfile.findMany({ where: { id: { in: sellerIds } } });
    const map = new Map<string, ShopDelivery>();
    for (const id of sellerIds) {
      const s = sellers.find((x) => x.id === id);
      const own = s?.ownDeliveryStatus === 'APPROVED' ? settingsOf(s) : null;
      if (!s || !own) {
        map.set(id, { own: false, fee: platformFee, courier: null, eta: platformEta, codPaused: false });
        continue;
      }
      const { balance } = await this.payouts.summaryFor(id);
      map.set(id, {
        own: true,
        // No address yet: show the inside-Dhaka fee like the platform default does.
        fee: zone === 'OUTSIDE_DHAKA' ? own.outsideDhakaFee : own.insideDhakaFee,
        courier: ownCourierName(own),
        eta: zone === 'OUTSIDE_DHAKA' ? own.outsideDhakaEta : zone === 'INSIDE_DHAKA' ? own.insideDhakaEta : null,
        codPaused: balance < -app.ownDeliveryDueLimit,
      });
    }
    return map;
  }
}
