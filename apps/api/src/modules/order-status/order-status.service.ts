import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { canTransitionOrder, type OrderStatus } from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  aggregateStatus,
  canAdminTransition,
  canSellerTransition,
  RESTOCK_ON_CANCEL_FROM,
} from './order-status.rules.js';

export type Actor = 'customer' | 'seller' | 'admin' | 'system';

export interface TransitionOptions {
  actor: Actor;
  actorId?: string | null;
  note?: string | null;
  trackingNumber?: string | null;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Order placed',
  CONFIRMED: 'Order confirmed',
  PROCESSING: 'Being packed',
  SHIPPED: 'Handed to courier',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
};

export const statusLabel = (s: OrderStatus) => STATUS_LABEL[s];

/** The order state machine. All status changes go through here, inside a transaction. */
@Injectable()
export class OrderStatusService {
  private allowed(actor: Actor, from: OrderStatus, to: OrderStatus): boolean {
    switch (actor) {
      case 'admin':
        return canAdminTransition(from, to);
      case 'seller':
        return canSellerTransition(from, to);
      default:
        return canTransitionOrder(from, to);
    }
  }

  /** Returns stock (and flash-sale allocation) for every item of a sub-order. */
  async restock(tx: Prisma.TransactionClient, subOrderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({ where: { subOrderId } });
    for (const item of items) {
      await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
      await tx.product.update({ where: { id: item.productId }, data: { soldCount: { decrement: item.quantity } } });
      if (item.flashSaleItemId) {
        await tx.$executeRaw`
          UPDATE "FlashSaleItem" SET "soldCount" = GREATEST(0, "soldCount" - ${item.quantity})
          WHERE id = ${item.flashSaleItemId}`;
      }
    }
  }

  async transitionSubOrder(
    tx: Prisma.TransactionClient,
    subOrderId: string,
    to: OrderStatus,
    opts: TransitionOptions,
  ): Promise<void> {
    const sub = await tx.subOrder.findUnique({ where: { id: subOrderId } });
    if (!sub) throw new NotFoundException('Order not found');
    if (sub.status === to) return;
    if (!this.allowed(opts.actor, sub.status, to)) {
      throw new BadRequestException(`Cannot change status from ${sub.status} to ${to}`);
    }
    // Conditional update protects against concurrent transitions.
    const { count } = await tx.subOrder.updateMany({
      where: { id: subOrderId, status: sub.status },
      data: { status: to, ...(opts.trackingNumber ? { trackingNumber: opts.trackingNumber } : {}) },
    });
    if (count === 0) throw new BadRequestException('Order status changed meanwhile. Refresh and try again.');

    await tx.orderStatusHistory.create({
      data: {
        orderId: sub.orderId,
        subOrderId,
        fromStatus: sub.status,
        toStatus: to,
        note: opts.note,
        actorId: opts.actorId,
      },
    });
    if (to === 'CANCELLED' && RESTOCK_ON_CANCEL_FROM.includes(sub.status)) await this.restock(tx, subOrderId);
    await this.recompute(tx, sub.orderId, opts);
  }

  /** Applies a status to every sub-order of an order that can take it. */
  async transitionOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    to: OrderStatus,
    opts: TransitionOptions,
  ): Promise<void> {
    const subs = await tx.subOrder.findMany({ where: { orderId } });
    const movable = subs.filter((s) => s.status !== to && this.allowed(opts.actor, s.status, to));
    if (movable.length === 0) throw new BadRequestException(`Cannot change this order to ${to}`);
    for (const s of movable) await this.transitionSubOrder(tx, s.id, to, opts);
  }

  /** Re-derives the order status from its sub-orders and records the change. */
  async recompute(tx: Prisma.TransactionClient, orderId: string, opts: TransitionOptions): Promise<OrderStatus> {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { subOrders: true } });
    const next = aggregateStatus(order.subOrders.map((s) => s.status));
    if (next !== order.status) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: next,
          ...(next === 'DELIVERED' && order.paymentMethod === 'COD' ? { paymentStatus: 'PAID' as const } : {}),
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: next, note: opts.note, actorId: opts.actorId },
      });
      if (next === 'DELIVERED' && order.paymentMethod === 'COD') {
        await tx.payment.updateMany({
          where: { orderId, method: 'COD', status: { in: ['UNPAID', 'PENDING'] } },
          data: { status: 'PAID', paidAt: new Date() },
        });
      }
    }
    return next;
  }
}
