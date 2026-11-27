import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  type BookShipmentInput,
  BookShipmentSchema,
  COURIER_CATALOG,
  COURIER_PROVIDERS,
  type CourierLocation,
  type CourierOption,
  type CourierProvider,
  type CourierStoreInput,
  type CourierStoreView,
  type OrderStatus,
  type ShipmentView,
} from '@marketbd/shared';
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import type { CourierStore, SellerProfile, Shipment } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { courierPath } from '../order-status/order-status.rules.js';
import { OrderStatusService, statusLabel } from '../order-status/order-status.service.js';
import { asShippingAddress, toShipmentView } from '../orders/order.mapper.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';
import { CourierAccountsService } from './courier-accounts.service.js';
import type { CourierEffect, WebhookUpdate } from './couriers/courier.adapter.js';
import { CourierRegistry } from './couriers/courier.registry.js';
import { merchantOrderId, toCourierTaka, toLocalPhone } from './shipping.rules.js';

/** A package can be booked once the seller accepted it and before it left. */
const BOOKABLE: readonly OrderStatus[] = ['CONFIRMED', 'PROCESSING'];
const SYNC_EVERY_MS = 15 * 60 * 1000;
const SYNC_STALE_MS = 20 * 60 * 1000;
const poisha = (taka: number | null): number | null => (taka === null ? null : Math.round(taka * 100));

const toStoreView = (s: CourierStore): CourierStoreView => ({
  provider: s.provider,
  name: s.name,
  contactName: s.contactName,
  contactNumber: s.contactNumber,
  address: s.address,
  cityId: s.cityId,
  zoneId: s.zoneId,
  areaId: s.areaId,
  ready: s.externalId !== null,
});

type ShipmentWithPackage = Shipment & {
  subOrder: {
    id: string;
    status: OrderStatus;
    order: { id: string; userId: string; orderNumber: string };
    seller: SellerProfile;
  };
};

/** Books parcels with the enabled couriers and keeps package status in step with them. */
@Injectable()
export class ShippingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Shipping');
  private readonly booking = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: CourierRegistry,
    private readonly accounts: CourierAccountsService,
    private readonly status: OrderStatusService,
    private readonly notifications: NotificationsService,
    private readonly access: SellerAccessService,
  ) {}

  onModuleInit(): void {
    // Safety net for missed webhooks: poll packages still on the road.
    if (env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.syncActive().catch((e: Error) => this.logger.error(e.message)), SYNC_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ───── Courier options and pickup stores ─────

  /** Couriers this shop can book with, and its pickup store at each. */
  async optionsFor(seller: SellerProfile): Promise<CourierOption[]> {
    const providers = await this.accounts.enabledProviders();
    const stores = await this.prisma.courierStore.findMany({ where: { sellerId: seller.id, provider: { in: providers } } });
    const options: CourierOption[] = [];
    for (const provider of providers) {
      const entry = COURIER_CATALOG[provider];
      let store = stores.find((s) => s.provider === provider) ?? null;
      if (store && !store.externalId) store = await this.resolveStore(store).catch(() => store);
      options.push({
        provider,
        name: entry.name,
        supportsStores: entry.supportsStores,
        needsWeight: entry.needsWeight,
        note: entry.note ?? null,
        store: store ? toStoreView(store) : null,
        ready: !entry.supportsStores || Boolean(store?.externalId),
      });
    }
    return options;
  }

  async sellerOptions(userId: string): Promise<CourierOption[]> {
    return this.optionsFor(await this.access.requireActiveSeller(userId));
  }

  /** Couriers a shop can book its own-delivery parcels with (its own connected accounts). */
  async ownOptions(userId: string): Promise<CourierOption[]> {
    const seller = await this.access.requireActiveSeller(userId);
    const rows = await this.accounts.sellerEnabledAccounts(seller.id);
    return COURIER_PROVIDERS.filter((p) => rows.some((r) => r.provider === p)).map((provider) => {
      const entry = COURIER_CATALOG[provider];
      const row = rows.find((r) => r.provider === provider)!;
      return {
        provider,
        name: entry.name,
        supportsStores: entry.supportsStores,
        needsWeight: entry.needsWeight,
        note: entry.note ?? null,
        store: null,
        ready: !entry.supportsStores || Boolean(row.storeExternalId),
      };
    });
  }

  async houseOptions(): Promise<CourierOption[]> {
    return this.optionsFor(await this.access.houseStore());
  }

  async locations(provider: CourierProvider, kind: 'cities' | 'zones' | 'areas', parentId?: number): Promise<CourierLocation[]> {
    const adapter = this.registry.get(provider);
    if (!adapter.locations) throw new BadRequestException(`${COURIER_CATALOG[provider].name} has no pickup stores`);
    if (kind !== 'cities' && !parentId) throw new BadRequestException('Pick the parent location first');
    return adapter.locations(await this.accounts.context(provider), kind, parentId);
  }

  /**
   * Registers the shop's pickup point with the courier. Couriers cannot edit stores through their
   * APIs, so every save creates a new store and later bookings use it.
   */
  async saveStore(seller: SellerProfile, provider: CourierProvider, input: CourierStoreInput): Promise<CourierOption[]> {
    const adapter = this.registry.get(provider);
    if (!adapter.createStore) throw new BadRequestException(`${COURIER_CATALOG[provider].name} has no pickup stores`);
    const ctx = await this.accounts.context(provider);
    const name = `${seller.shopName.trim().slice(0, 42)} ${randomBytes(3).toString('hex').toUpperCase()}`;
    const externalId = await adapter.createStore(ctx, { ...input, name, contactNumber: toLocalPhone(input.contactNumber) });
    const data = { name, externalId, ...input };
    const store = await this.prisma.courierStore.upsert({
      where: { sellerId_provider: { sellerId: seller.id, provider } },
      create: { sellerId: seller.id, provider, ...data },
      update: data,
    });
    if (!store.externalId) await this.resolveStore(store).catch(() => store);
    return this.optionsFor(seller);
  }

  async saveSellerStore(userId: string, provider: CourierProvider, input: CourierStoreInput): Promise<CourierOption[]> {
    return this.saveStore(await this.access.requireActiveSeller(userId), provider, input);
  }

  async saveHouseStore(provider: CourierProvider, input: CourierStoreInput): Promise<CourierOption[]> {
    return this.saveStore(await this.access.houseStore(), provider, input);
  }

  /** New stores show up in the courier's store list (by name); remember their id. */
  private async resolveStore(store: CourierStore): Promise<CourierStore> {
    const adapter = this.registry.get(store.provider);
    if (!adapter.findStoreId) return store;
    const id = await adapter.findStoreId(await this.accounts.context(store.provider), store.name);
    if (!id) return store;
    return this.prisma.courierStore.update({ where: { id: store.id }, data: { externalId: id } });
  }

  // ───── Booking ─────

  async bookForSeller(userId: string, subOrderId: string, input: BookShipmentInput): Promise<ShipmentView> {
    const seller = await this.access.requireActiveSeller(userId);
    const sub = await this.prisma.subOrder.findFirst({ where: { id: subOrderId, sellerId: seller.id }, select: { id: true } });
    if (!sub) throw new NotFoundException('Order not found');
    return this.book(subOrderId, input, { actor: 'seller', actorId: userId });
  }

  async bookForAdmin(actorId: string, orderId: string, subOrderId: string, input: BookShipmentInput): Promise<ShipmentView> {
    const sub = await this.prisma.subOrder.findFirst({ where: { id: subOrderId, orderId }, select: { id: true } });
    if (!sub) throw new NotFoundException('Sub-order not found');
    return this.book(subOrderId, input, { actor: 'admin', actorId });
  }

  private async book(
    subOrderId: string,
    raw: BookShipmentInput,
    who: { actor: 'seller' | 'admin'; actorId: string },
  ): Promise<ShipmentView> {
    const input = BookShipmentSchema.parse(raw);
    const provider = input.provider;
    const entry = COURIER_CATALOG[provider];
    const owner = await this.prisma.subOrder.findUniqueOrThrow({ where: { id: subOrderId }, select: { fulfillment: true, sellerId: true } });
    // Own delivery: book on the shop's own courier account instead of the platform's.
    const accountSellerId = owner.fulfillment === 'SELLER' ? owner.sellerId : null;
    const ctx = accountSellerId ? await this.accounts.sellerContext(accountSellerId, provider) : await this.accounts.context(provider);
    // One booking at a time per package, so a double click cannot pay for two parcels.
    if (this.booking.has(subOrderId)) throw new ConflictException('This package is already being booked');
    this.booking.add(subOrderId);
    try {
      const sub = await this.prisma.subOrder.findUniqueOrThrow({
        where: { id: subOrderId },
        include: { order: true, items: true, shipments: { orderBy: { createdAt: 'desc' } } },
      });
      if (sub.order.channel === 'POS') throw new BadRequestException('Counter sales are not shipped');
      if (!BOOKABLE.includes(sub.status)) {
        throw new BadRequestException(
          sub.status === 'PENDING' ? 'Confirm the order before booking the courier' : `A ${sub.status.toLowerCase()} package cannot be booked`,
        );
      }
      if (sub.shipments.some((s) => s.active)) throw new ConflictException('This package is already booked with a courier');

      let storeExternalId: string | null = null;
      if (entry.supportsStores && accountSellerId) {
        storeExternalId = (await this.accounts.sellerAccount(accountSellerId, provider))?.storeExternalId ?? null;
        if (!storeExternalId) throw new BadRequestException(`Add your ${entry.name} store ID in Courier settings first`);
      } else if (entry.supportsStores) {
        let store = await this.prisma.courierStore.findUnique({ where: { sellerId_provider: { sellerId: sub.sellerId, provider } } });
        if (!store) throw new BadRequestException(`Set up the ${entry.name} pickup address first (Courier settings)`);
        if (!store.externalId) store = await this.resolveStore(store);
        if (!store.externalId) throw new BadRequestException(`${entry.name} is still approving the pickup address. Try again in about an hour.`);
        storeExternalId = store.externalId;
      }

      const address = asShippingAddress(sub.order.shippingAddress);
      const cod = sub.order.paymentMethod === 'COD' && sub.order.paymentStatus !== 'PAID' ? sub.total : 0;
      const reference = merchantOrderId(sub.order.orderNumber, sub.id, sub.shipments.length + 1);
      const result = await this.registry.get(provider).book(ctx, {
        reference,
        storeExternalId,
        recipientName: address.fullName,
        recipientPhone: toLocalPhone(address.phone),
        recipientAddress: [address.addressLine, address.landmark && `near ${address.landmark}`, address.area, address.district].filter(Boolean).join(', '),
        codTaka: toCourierTaka(cod),
        quantity: sub.items.reduce((n, i) => n + i.quantity, 0),
        weightKg: input.itemWeight,
        description: input.itemDescription || sub.items.map((i) => `${i.title} x${i.quantity}`).join(', '),
        instruction: input.specialInstruction,
      });

      const shipment = await this.prisma.$transaction(async (tx) => {
        const row = await tx.shipment.create({
          data: {
            subOrderId: sub.id,
            provider,
            consignmentId: result.consignmentId,
            trackingCode: result.trackingCode,
            merchantOrderId: reference,
            storeExternalId,
            courierStatus: result.status.slice(0, 64),
            codAmount: cod,
            deliveryFee: poisha(result.deliveryFeeTaka),
            accountSellerId,
          },
        });
        await tx.subOrder.update({ where: { id: sub.id }, data: { trackingNumber: result.trackingCode ?? result.consignmentId } });
        if (sub.status === 'CONFIRMED') {
          await this.status.transitionSubOrder(tx, sub.id, 'PROCESSING', { ...who, note: `Booked with ${entry.name} (${result.consignmentId})` });
        }
        return row;
      });
      if (sub.status === 'CONFIRMED') await this.notifyCustomer(sub.order.userId, sub.order.id, sub.order.orderNumber, 'PROCESSING');
      return toShipmentView(shipment);
    } finally {
      this.booking.delete(subOrderId);
    }
  }

  // ───── Courier updates (webhook + sync) ─────

  /** Authenticates and applies a webhook. Returns the HTTP status and headers the courier expects. */
  async handleWebhook(
    provider: CourierProvider,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
    sellerId: string | null = null,
  ): Promise<{ httpStatus: number; headers: Record<string, string> }> {
    const secret = sellerId ? ((await this.accounts.sellerAccount(sellerId, provider))?.webhookSecret ?? null) : await this.accounts.webhookSecret(provider);
    const result = this.registry.get(provider).webhook(headers, body, secret ?? randomBytes(24).toString('hex'));
    const out = { httpStatus: result.httpStatus, headers: result.responseHeaders ?? {} };
    if (!secret || !result.authorized) return { ...out, httpStatus: 401 };
    if (result.update) await this.applyUpdate(provider, result.update, sellerId);
    return out;
  }

  /** Applies one courier update. Unknown consignments and out-of-order updates are ignored. */
  async applyUpdate(provider: CourierProvider, update: WebhookUpdate, accountSellerId: string | null = null): Promise<void> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { provider_consignmentId: { provider, consignmentId: update.consignmentId } },
      include: { subOrder: { include: { order: true, seller: true } } },
    });
    // The update must come from the account the parcel was booked on.
    if (!shipment || shipment.accountSellerId !== accountSellerId) return;
    if (update.updatedAt && shipment.courierUpdatedAt && update.updatedAt < shipment.courierUpdatedAt) return;

    let effect = this.registry.get(provider).effect(update.status);
    // A cancellation before the parcel left the shop only ends the booking; the seller can book again.
    if (effect === 'returned' && shipment.subOrder.status !== 'SHIPPED') effect = 'pickup_cancelled';
    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        courierStatus: update.status.slice(0, 64),
        ...(update.updatedAt ? { courierUpdatedAt: update.updatedAt } : {}),
        ...(effect === 'pickup_cancelled' ? { active: false } : {}),
        ...(update.collectedAmount !== null ? { collectedAmount: poisha(update.collectedAmount) } : {}),
        ...(update.deliveryFee !== null ? { deliveryFee: poisha(update.deliveryFee) } : {}),
      },
    });
    if (!shipment.active) return; // an old, cancelled booking must not move the package
    await this.applyEffect(shipment, effect);
  }

  private async applyEffect(shipment: ShipmentWithPackage, effect: CourierEffect): Promise<void> {
    const sub = shipment.subOrder;
    const name = COURIER_CATALOG[shipment.provider].name;
    if (effect === 'pickup_cancelled') {
      await this.notifications.notify(
        sub.seller.userId,
        'SELLER',
        'Courier booking cancelled',
        `${name} cancelled the booking for order ${sub.order.orderNumber}. Book a courier again or cancel the order.`,
        { orderId: sub.order.id, subOrderId: sub.id },
      );
      return;
    }
    const target: OrderStatus | null = effect === 'shipped' ? 'SHIPPED' : effect === 'delivered' ? 'DELIVERED' : effect === 'returned' ? 'CANCELLED' : null;
    if (!target) return;
    const path = courierPath(sub.status, target);
    if (path.length === 0) return;

    const note = effect === 'returned' ? `Returned by ${name} (not delivered)` : `${name}: ${shipment.courierStatus}`;
    await this.prisma.$transaction(async (tx) => {
      for (const step of path) await this.status.transitionSubOrder(tx, sub.id, step, { actor: 'courier', note });
    });
    await this.notifyCustomer(sub.order.userId, sub.order.id, sub.order.orderNumber, target);
    if (effect === 'returned') {
      await this.notifications.notify(
        sub.seller.userId,
        'SELLER',
        'Parcel returned',
        `${name} is returning the parcel for order ${sub.order.orderNumber}. The order was cancelled and stock restored.`,
        { orderId: sub.order.id, subOrderId: sub.id },
      );
    }
  }

  private notifyCustomer(userId: string, orderId: string, orderNumber: string, status: OrderStatus) {
    return this.notifications.notify(userId, 'ORDER', statusLabel(status), `Order ${orderNumber}: ${statusLabel(status)}.`, { orderId, status });
  }

  /** Pulls the latest status of one booking from its courier. */
  async syncShipment(shipmentId: string): Promise<ShipmentView> {
    const shipment = await this.prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    const ctx = shipment.accountSellerId
      ? await this.accounts.sellerContext(shipment.accountSellerId, shipment.provider, { requireEnabled: false })
      : await this.accounts.context(shipment.provider, { requireEnabled: false });
    const res = await this.registry.get(shipment.provider).status(ctx, shipment.consignmentId);
    if (res.status) {
      await this.applyUpdate(
        shipment.provider,
        { consignmentId: shipment.consignmentId, status: res.status, updatedAt: res.updatedAt, collectedAmount: null, deliveryFee: null },
        shipment.accountSellerId,
      );
    } else {
      await this.prisma.shipment.update({ where: { id: shipmentId }, data: { updatedAt: new Date() } });
    }
    return toShipmentView(await this.prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } }));
  }

  private async latestShipmentId(where: { id: string; sellerId?: string; orderId?: string }): Promise<string> {
    const sub = await this.prisma.subOrder.findFirst({
      where,
      select: { shipments: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
    });
    if (!sub) throw new NotFoundException('Order not found');
    const id = sub.shipments[0]?.id;
    if (!id) throw new BadRequestException('This package has not been booked with a courier');
    return id;
  }

  async syncForSeller(userId: string, subOrderId: string): Promise<ShipmentView> {
    const seller = await this.access.requireActiveSeller(userId);
    return this.syncShipment(await this.latestShipmentId({ id: subOrderId, sellerId: seller.id }));
  }

  async syncForAdmin(orderId: string, subOrderId: string): Promise<ShipmentView> {
    return this.syncShipment(await this.latestShipmentId({ id: subOrderId, orderId }));
  }

  /** Re-checks bookings still on the road that have not heard from their courier for a while. */
  async syncActive(limit = 50): Promise<number> {
    const rows = await this.prisma.shipment.findMany({
      where: {
        active: true,
        updatedAt: { lt: new Date(Date.now() - SYNC_STALE_MS) },
        subOrder: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED'] } },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    for (const r of rows) await this.syncShipment(r.id).catch((e: Error) => this.logger.warn(`sync ${r.id}: ${e.message}`));
    return rows.length;
  }
}
