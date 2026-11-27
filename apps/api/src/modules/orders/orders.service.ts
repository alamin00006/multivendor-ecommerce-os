import type { z } from 'zod';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BRAND, CUSTOMER_CANCELLABLE_STATUSES } from '@marketbd/shared';
import type {
  SellerReturnUpdateInput,
  SellerReturnView,
  CancelOrderInput,
  OrderDetail,
  OrderListQuerySchema,
  OrderStatus,
  ReturnableOrder,
  ReturnRequestPayload,
  SellerOrderView,
  UpdateOrderStatusInput,
  UpdateReturnInput,
} from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { OrderMessagesService } from '../notifications/order-messages.service.js';
import { OrderStatusService, statusLabel } from '../order-status/order-status.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';
import {
  asShippingAddress,
  canReturnOrder,
  deliveredAt,
  orderDetailInclude,
  orderSummaryInclude,
  sellerOrderInclude,
  toOrderDetail,
  toOrderSummary,
  toSellerOrderView,
} from './order.mapper.js';

type ListQuery = z.infer<typeof OrderListQuerySchema>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: OrderStatusService,
    private readonly payments: PaymentsService,
    private readonly mode: PlatformModeService,
    private readonly settings: SettingsService,
    private readonly access: SellerAccessService,
    private readonly notifications: NotificationsService,
    private readonly messages: OrderMessagesService,
  ) {}

  private listWhere(query: ListQuery): Prisma.OrderWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      // Same rule as `canPay` on the order: online method, still pending, not paid yet.
      ...(query.toPay
        ? { paymentMethod: { notIn: ['COD', 'CASH'] as ('COD' | 'CASH')[] }, status: 'PENDING' as const, paymentStatus: { in: ['UNPAID', 'PENDING', 'FAILED'] as ('UNPAID' | 'PENDING' | 'FAILED')[] } }
        : {}),
      // Same rule as `canCancel` on the order: not shipped anywhere yet.
      ...(query.cancellable
        ? {
            status: { in: [...CUSTOMER_CANCELLABLE_STATUSES] },
            subOrders: { every: { status: { in: [...CUSTOMER_CANCELLABLE_STATUSES, 'CANCELLED' as const] } } },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { orderNumber: { contains: query.q, mode: 'insensitive' } },
              { user: { phone: { contains: query.q } } },
              { user: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private async detail(where: Prisma.OrderWhereInput, withCustomer = false): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({ where, include: orderDetailInclude });
    if (!order) throw new NotFoundException('Order not found');
    const [multiVendor, returnDays] = await Promise.all([this.mode.isMultiVendor(), this.settings.returnDays()]);
    return toOrderDetail(order, multiVendor, returnDays, withCustomer);
  }

  // ───── Customer ─────

  async listMine(userId: string, query: ListQuery) {
    const where = { userId, ...this.listWhere(query) };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderSummaryInclude,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.order.count({ where }),
    ]);
    return PaginatedResult.of(
      rows.map((o) => toOrderSummary(o)),
      query.page,
      query.limit,
      total,
    );
  }

  getMine(userId: string, id: string): Promise<OrderDetail> {
    return this.detail({ id, userId });
  }

  async cancelMine(userId: string, id: string, input: CancelOrderInput): Promise<OrderDetail> {
    const order = await this.getMine(userId, id);
    if (!order.canCancel) throw new BadRequestException('This order can no longer be cancelled');
    await this.prisma.$transaction((tx) =>
      this.status.transitionOrder(tx, id, 'CANCELLED', { actor: 'customer', actorId: userId, note: input.reason }),
    );
    this.messages.statusChanged(id, 'CANCELLED');
    return this.getMine(userId, id);
  }

  async requestReturn(userId: string, id: string, input: ReturnRequestPayload): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, include: orderDetailInclude });
    if (!order) throw new NotFoundException('Order not found');
    if (!canReturnOrder(order, await this.settings.returnDays())) {
      throw new BadRequestException('This order is not eligible for return');
    }
    const targets = order.subOrders.filter(
      (s) => s.status === 'DELIVERED' && (!input.subOrderId || s.id === input.subOrderId),
    );
    if (targets.length === 0) throw new BadRequestException('No delivered items to return');

    await this.prisma.$transaction(async (tx) => {
      for (const s of targets) {
        await tx.returnRequest.create({
          data: { orderId: id, subOrderId: s.id, reason: input.reason, imageUrls: input.imageUrls ?? [] },
        });
        await this.status.transitionSubOrder(tx, s.id, 'RETURN_REQUESTED', {
          actor: 'customer',
          actorId: userId,
          note: input.reason,
        });
      }
    });
    return this.getMine(userId, id);
  }

  // ───── Seller ─────

  async listForSeller(userId: string, query: ListQuery) {
    const seller = await this.access.requireActiveSeller(userId);
    const where: Prisma.SubOrderWhereInput = {
      sellerId: seller.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { order: { orderNumber: { contains: query.q, mode: 'insensitive' } } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.subOrder.findMany({
        where,
        include: sellerOrderInclude,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.subOrder.count({ where }),
    ]);
    return PaginatedResult.of(rows.map(toSellerOrderView), query.page, query.limit, total);
  }

  async getForSeller(userId: string, subOrderId: string): Promise<SellerOrderView> {
    const seller = await this.access.requireActiveSeller(userId);
    const sub = await this.prisma.subOrder.findFirst({
      where: { id: subOrderId, sellerId: seller.id },
      include: sellerOrderInclude,
    });
    if (!sub) throw new NotFoundException('Order not found');
    return toSellerOrderView(sub);
  }

  async updateBySeller(userId: string, subOrderId: string, input: UpdateOrderStatusInput): Promise<SellerOrderView> {
    const seller = await this.access.requireActiveSeller(userId);
    const sub = await this.prisma.subOrder.findFirst({
      where: { id: subOrderId, sellerId: seller.id },
      include: { order: true },
    });
    if (!sub) throw new NotFoundException('Order not found');
    if (input.status === 'SHIPPED' && sub.fulfillment === 'SELLER' && !input.trackingNumber?.trim()) {
      throw new BadRequestException(`Enter the ${sub.courierName ?? 'courier'} tracking number`);
    }
    await this.prisma.$transaction((tx) =>
      this.status.transitionSubOrder(tx, subOrderId, input.status, {
        actor: 'seller',
        actorId: userId,
        note: input.note,
        trackingNumber: input.trackingNumber,
      }),
    );
    await this.notifyCustomer(sub.order.userId, sub.order.id, sub.order.orderNumber, input.status);
    this.messages.statusChanged(sub.order.id, input.status, subOrderId);
    return this.getForSeller(userId, subOrderId);
  }

  private notifyCustomer(userId: string, orderId: string, orderNumber: string, status: OrderStatus) {
    return this.notifications.notify(
      userId,
      'ORDER',
      statusLabel(status),
      `Order ${orderNumber}: ${statusLabel(status)}.`,
      {
        orderId,
        status,
      },
    );
  }

  // ───── Admin ─────

  async listAll(query: ListQuery) {
    const where = this.listWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderSummaryInclude,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.order.count({ where }),
    ]);
    return PaginatedResult.of(
      rows.map((o) => toOrderSummary(o, true)),
      query.page,
      query.limit,
      total,
    );
  }

  getAny(id: string): Promise<OrderDetail> {
    return this.detail({ id }, true);
  }

  async adminSetStatus(
    actorId: string,
    id: string,
    input: UpdateOrderStatusInput,
    subOrderId?: string,
  ): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    await this.prisma.$transaction(async (tx) => {
      const opts = { actor: 'admin' as const, actorId, note: input.note, trackingNumber: input.trackingNumber };
      if (subOrderId) {
        const sub = await tx.subOrder.findFirst({ where: { id: subOrderId, orderId: id } });
        if (!sub) throw new NotFoundException('Sub-order not found');
        await this.status.transitionSubOrder(tx, subOrderId, input.status, opts);
      } else {
        await this.status.transitionOrder(tx, id, input.status, opts);
      }
    });
    await this.notifyCustomer(order.userId, order.id, order.orderNumber, input.status);
    this.messages.statusChanged(order.id, input.status, subOrderId);
    return this.getAny(id);
  }

  async refund(actorId: string, id: string, amount: number, reason: string): Promise<OrderDetail> {
    await this.payments.refund(id, amount, reason, actorId);
    return this.getAny(id);
  }

  /** The signed-in customer's return requests, newest first, with the package's shop and items. */
  async listMyReturns(userId: string, query: { page: number; limit: number; status?: string }) {
    const where: Prisma.ReturnRequestWhereInput = {
      order: { userId },
      ...(query.status ? { status: query.status as Prisma.ReturnRequestWhereInput['status'] } : {}),
    };
    const [rows, total, multiVendor] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        include: {
          order: { select: { id: true, orderNumber: true, total: true } },
          subOrder: {
            select: {
              seller: { select: { shopName: true } },
              items: { select: { title: true, imageUrl: true, quantity: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.returnRequest.count({ where }),
      this.mode.isMultiVendor(),
    ]);
    return PaginatedResult.of(
      rows.map((r) => ({
        id: r.id,
        orderId: r.order.id,
        orderNumber: r.order.orderNumber,
        orderTotal: r.order.total,
        subOrderId: r.subOrderId,
        reason: r.reason,
        imageUrls: r.imageUrls,
        status: r.status,
        adminNote: r.adminNote,
        sellerNote: r.sellerNote,
        shopName: r.subOrder ? (multiVendor ? r.subOrder.seller.shopName : BRAND.name) : null,
        items: r.subOrder?.items ?? [],
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      query.page,
      query.limit,
      total,
    );
  }

  /** Delivered orders still inside the return window, with the packages that can be sent back. */
  async listReturnable(userId: string): Promise<ReturnableOrder[]> {
    const [rows, returnDays, multiVendor] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId, subOrders: { some: { status: 'DELIVERED' } } },
        include: orderDetailInclude,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.settings.returnDays(),
      this.mode.isMultiVendor(),
    ]);
    return rows
      .filter((o) => canReturnOrder(o, returnDays))
      .map((o) => {
        const at = deliveredAt(o);
        return {
          orderId: o.id,
          orderNumber: o.orderNumber,
          deliveredAt: at?.toISOString() ?? null,
          returnBy: at ? new Date(at.getTime() + returnDays * 86_400_000).toISOString() : null,
          packages: o.subOrders
            .filter((s) => s.status === 'DELIVERED')
            .map((s) => ({
              subOrderId: s.id,
              shopName: multiVendor ? s.seller.shopName : BRAND.name,
              items: s.items.map((i) => ({
                title: i.title,
                imageUrl: i.imageUrl,
                variantLabel: i.variantLabel,
                quantity: i.quantity,
                lineTotal: i.lineTotal,
              })),
            })),
        };
      });
  }

  async listReturns(query: { page: number; limit: number; status?: string }) {
    const where: Prisma.ReturnRequestWhereInput = query.status
      ? { status: query.status as Prisma.ReturnRequestWhereInput['status'] }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        include: { order: { select: { id: true, orderNumber: true, total: true } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.returnRequest.count({ where }),
    ]);
    return PaginatedResult.of(
      rows.map((r) => ({
        id: r.id,
        orderId: r.order.id,
        orderNumber: r.order.orderNumber,
        orderTotal: r.order.total,
        subOrderId: r.subOrderId,
        reason: r.reason,
        imageUrls: r.imageUrls,
        status: r.status,
        adminNote: r.adminNote,
        sellerNote: r.sellerNote,
        createdAt: r.createdAt.toISOString(),
      })),
      query.page,
      query.limit,
      total,
    );
  }

  /** Moves a return through review → received; refunds are issued via the refund endpoint. */
  async updateReturn(actorId: string, returnId: string, input: UpdateReturnInput): Promise<OrderDetail> {
    const ret = await this.prisma.returnRequest.findUnique({ where: { id: returnId }, include: { order: true } });
    if (!ret) throw new NotFoundException('Return request not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: returnId },
        data: { status: input.status, adminNote: input.adminNote },
      });
      if (!ret.subOrderId) return;
      const opts = {
        actor: 'admin' as const,
        actorId,
        note: input.adminNote ?? `Return ${input.status.toLowerCase()}`,
      };
      if (input.status === 'REJECTED') await this.status.transitionSubOrder(tx, ret.subOrderId, 'DELIVERED', opts);
      if (input.status === 'RECEIVED') {
        await this.status.transitionSubOrder(tx, ret.subOrderId, 'RETURNED', opts);
        await this.status.restock(tx, ret.subOrderId);
      }
    });
    await this.notifications.notify(
      ret.order.userId,
      'ORDER',
      'Return update',
      `Your return for order ${ret.order.orderNumber} is now ${input.status.toLowerCase()}.`,
      { orderId: ret.orderId },
    );
    return this.getAny(ret.orderId);
  }

  // ───── Seller returns ─────

  /** Returns on the seller's packages (whole-order returns are shown read-only). */
  async listSellerReturns(userId: string, query: { page: number; limit: number; status?: string }) {
    const seller = await this.access.requireActiveSeller(userId);
    const where: Prisma.ReturnRequestWhereInput = {
      OR: [{ subOrder: { sellerId: seller.id } }, { subOrderId: null, order: { subOrders: { some: { sellerId: seller.id } } } }],
      ...(query.status ? { status: query.status as Prisma.ReturnRequestWhereInput['status'] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        include: {
          order: { select: { id: true, orderNumber: true, shippingAddress: true, user: { select: { name: true, phone: true } } } },
          subOrder: { select: { total: true, items: { select: { title: true, variantLabel: true, imageUrl: true, quantity: true, lineTotal: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.returnRequest.count({ where }),
    ]);
    return PaginatedResult.of(
      rows.map<SellerReturnView>((r) => {
        const address = asShippingAddress(r.order.shippingAddress);
        return {
          id: r.id,
          orderId: r.order.id,
          orderNumber: r.order.orderNumber,
          subOrderId: r.subOrderId,
          canAct: Boolean(r.subOrderId),
          reason: r.reason,
          imageUrls: r.imageUrls,
          status: r.status,
          adminNote: r.adminNote,
          sellerNote: r.sellerNote,
          customer: { name: address.fullName || r.order.user.name, phone: address.phone || r.order.user.phone },
          items: r.subOrder?.items ?? [],
          amount: r.subOrder?.total ?? 0,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      }),
      query.page,
      query.limit,
      total,
    );
  }

  /**
   * Seller decides on a return of their own package: approve or reject a new request, then mark the
   * parcel received (which restocks it). Refunds stay with admin.
   */
  async sellerUpdateReturn(userId: string, returnId: string, input: SellerReturnUpdateInput) {
    const seller = await this.access.requireActiveSeller(userId);
    const ret = await this.prisma.returnRequest.findFirst({
      where: { id: returnId, subOrder: { sellerId: seller.id } },
      include: { order: true },
    });
    if (!ret || !ret.subOrderId) throw new NotFoundException('Return request not found');
    const allowed: Record<string, string[]> = { REQUESTED: ['APPROVED', 'REJECTED'], APPROVED: ['RECEIVED', 'REJECTED'] };
    if (!allowed[ret.status]?.includes(input.status)) {
      throw new BadRequestException(`A ${ret.status.toLowerCase()} return cannot be marked ${input.status.toLowerCase()}`);
    }
    if (input.status === 'REJECTED' && !input.sellerNote) throw new BadRequestException('Tell the customer why the return is rejected');
    const subOrderId = ret.subOrderId;
    await this.prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({ where: { id: returnId }, data: { status: input.status, sellerNote: input.sellerNote ?? ret.sellerNote } });
      const opts = { actor: 'system' as const, actorId: userId, note: input.sellerNote ?? `Return ${input.status.toLowerCase()} by the shop` };
      if (input.status === 'REJECTED') await this.status.transitionSubOrder(tx, subOrderId, 'DELIVERED', opts);
      if (input.status === 'RECEIVED') {
        await this.status.transitionSubOrder(tx, subOrderId, 'RETURNED', opts);
        await this.status.restock(tx, subOrderId);
      }
    });
    const message: Record<string, string> = {
      APPROVED: 'was approved. Please send the item back to the shop.',
      REJECTED: `was rejected: ${input.sellerNote ?? ''}`,
      RECEIVED: 'was received by the shop. Your refund will be processed shortly.',
    };
    await this.notifications.notify(ret.order.userId, 'ORDER', 'Return update', `Your return for order ${ret.order.orderNumber} ${message[input.status]}`, { orderId: ret.orderId });
    if (input.status === 'RECEIVED') {
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      for (const a of admins)
        await this.notifications.notify(a.id, 'ORDER', 'Return ready for refund', `${seller.shopName} received the return for order ${ret.order.orderNumber}.`, { orderId: ret.orderId });
    }
    return (await this.listSellerReturns(userId, { page: 1, limit: 100 })).items.find((r) => r.id === returnId)!;
  }

}
