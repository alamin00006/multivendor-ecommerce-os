import type { z } from 'zod';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CancelOrderInput,
  OrderDetail,
  OrderListQuerySchema,
  OrderStatus,
  ReturnRequestPayload,
  SellerOrderView,
  UpdateOrderStatusInput,
  UpdateReturnInput,
} from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { OrderStatusService, statusLabel } from '../order-status/order-status.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';
import {
  canReturnOrder,
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
  ) {}

  private listWhere(query: ListQuery): Prisma.OrderWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
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
    await this.prisma.$transaction((tx) =>
      this.status.transitionSubOrder(tx, subOrderId, input.status, {
        actor: 'seller',
        actorId: userId,
        note: input.note,
        trackingNumber: input.trackingNumber,
      }),
    );
    await this.notifyCustomer(sub.order.userId, sub.order.id, sub.order.orderNumber, input.status);
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
    return this.getAny(id);
  }

  async refund(actorId: string, id: string, amount: number, reason: string): Promise<OrderDetail> {
    await this.payments.refund(id, amount, reason, actorId);
    return this.getAny(id);
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
}
