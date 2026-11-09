import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BRAND, type PaymentClient, type PaymentInitResult, type PaymentMethod } from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { asShippingAddress } from '../orders/order.mapper.js';
import { OrderStatusService } from '../order-status/order-status.service.js';
import { BkashGateway } from './bkash.gateway.js';
import type { PaymentGateway } from './payment-gateway.js';
import { SslCommerzGateway } from './sslcommerz.gateway.js';

export type PaymentOutcome = 'success' | 'failed' | 'cancelled';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly bkash: BkashGateway,
    private readonly sslcommerz: SslCommerzGateway,
    private readonly status: OrderStatusService,
    private readonly notifications: NotificationsService,
  ) {}

  private gateway(method: PaymentMethod): PaymentGateway | null {
    if (method === 'BKASH') return this.bkash;
    if (method === 'SSLCOMMERZ') return this.sslcommerz;
    return null;
  }

  methods(): Array<{ method: PaymentMethod; enabled: boolean }> {
    return [
      { method: 'COD', enabled: true },
      { method: 'BKASH', enabled: this.bkash.enabled },
      { method: 'SSLCOMMERZ', enabled: this.sslcommerz.enabled },
    ];
  }

  assertMethodEnabled(method: PaymentMethod): void {
    if (!this.methods().find((m) => m.method === method)?.enabled) {
      throw new BadRequestException('This payment method is currently unavailable');
    }
  }

  /** Creates the initial payment row when an order is placed. */
  async createForOrder(
    tx: Prisma.TransactionClient,
    order: { id: string; paymentMethod: PaymentMethod; total: number },
    client: PaymentClient,
  ) {
    return tx.payment.create({
      data: {
        orderId: order.id,
        method: order.paymentMethod,
        amount: order.total,
        status: order.paymentMethod === 'COD' ? 'UNPAID' : 'PENDING',
        rawResponse: { client },
      },
    });
  }

  /** Starts (or restarts) the online payment for an order owned by the user. */
  async initiate(userId: string, orderId: string, client: PaymentClient): Promise<PaymentInitResult> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { user: true, items: { select: { title: true }, take: 3 } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentMethod === 'COD') {
      throw new BadRequestException('Cash on Delivery orders are paid to the delivery person');
    }
    if (order.status !== 'PENDING' || order.paymentStatus === 'PAID') {
      throw new BadRequestException('This order cannot be paid now');
    }
    const gateway = this.gateway(order.paymentMethod);
    if (!gateway?.enabled) throw new BadRequestException('This payment method is currently unavailable');

    const payment = await this.prisma.payment.create({
      data: { orderId, method: order.paymentMethod, amount: order.total, status: 'PENDING', rawResponse: { client } },
    });
    const address = asShippingAddress(order.shippingAddress);
    const result = await gateway.initiate({
      paymentId: payment.id,
      orderNumber: order.orderNumber,
      amount: order.total,
      customer: { name: order.user.name, email: order.user.email, phone: order.user.phone ?? address.phone },
      address: { line: address.addressLine, city: address.district },
      productName: order.items.map((i) => i.title).join(', ') || BRAND.name,
    });
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayRef: result.gatewayRef, rawResponse: { client, init: result.raw } as Prisma.InputJsonValue },
    });
    await this.prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'PENDING' } });
    return { paymentId: payment.id, method: order.paymentMethod, redirectUrl: result.redirectUrl };
  }

  private clientOf(raw: unknown): PaymentClient {
    return raw && typeof raw === 'object' && (raw as { client?: string }).client === 'mobile' ? 'mobile' : 'web';
  }

  /** Where the customer's browser is sent after the gateway finishes. */
  resultUrl(client: PaymentClient, orderId: string | null, outcome: PaymentOutcome): string {
    const query = new URLSearchParams({ status: outcome, ...(orderId ? { order: orderId } : {}) }).toString();
    return client === 'mobile'
      ? `${BRAND.deepLinkScheme}://checkout/result?${query}`
      : `${env.WEB_URL}/checkout/result?${query}`;
  }

  private async markPaid(paymentId: string, trxId: string | null, raw: Record<string, unknown>): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
      if (payment.status === 'PAID') return;
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          gatewayTrxId: trxId,
          rawResponse: { ...(payment.rawResponse as object | null), result: raw } as Prisma.InputJsonValue,
        },
      });
      await tx.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'PAID' } });
      if (payment.order.status === 'PENDING') {
        await this.status.transitionOrder(tx, payment.orderId, 'CONFIRMED', {
          actor: 'system',
          note: `Payment received via ${payment.method}`,
        });
      }
      await this.notifications.notify(
        payment.order.userId,
        'PAYMENT',
        'Payment received',
        `We received your payment for order ${payment.order.orderNumber}.`,
        { orderId: payment.orderId },
      );
    });
  }

  private async markFailed(paymentId: string, status: 'FAILED', raw: Record<string, unknown>): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === 'PAID') return;
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        rawResponse: { ...(payment.rawResponse as object | null), result: raw } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'FAILED' } });
  }

  /** bKash redirects the customer here with ?paymentID=&status=. */
  async handleBkashCallback(paymentID: string, status: string): Promise<string> {
    const payment = await this.prisma.payment.findUnique({ where: { gatewayRef: paymentID } });
    if (!payment) return this.resultUrl('web', null, 'failed');
    const client = this.clientOf(payment.rawResponse);
    if (payment.status === 'PAID') return this.resultUrl(client, payment.orderId, 'success');
    if (status !== 'success') {
      await this.markFailed(payment.id, 'FAILED', { status });
      return this.resultUrl(client, payment.orderId, status === 'cancel' ? 'cancelled' : 'failed');
    }
    try {
      const result = await this.bkash.execute(paymentID);
      if (result.success && (result.amount === null || result.amount === payment.amount)) {
        await this.markPaid(payment.id, result.trxId, result.raw);
        return this.resultUrl(client, payment.orderId, 'success');
      }
      await this.markFailed(payment.id, 'FAILED', result.raw);
    } catch (error) {
      this.logger.error(`bKash execute failed for ${paymentID}: ${String(error)}`);
      await this.markFailed(payment.id, 'FAILED', { error: 'execute_failed' });
    }
    return this.resultUrl(client, payment.orderId, 'failed');
  }

  /** SSLCommerz success/IPN: validate val_id server-side before marking paid. */
  async handleSslCommerz(
    kind: 'success' | 'fail' | 'cancel' | 'ipn',
    body: Record<string, string | undefined>,
  ): Promise<string> {
    const tranId = body.tran_id;
    const payment = tranId ? await this.prisma.payment.findUnique({ where: { id: tranId } }) : null;
    if (!payment) return this.resultUrl('web', null, 'failed');
    const client = this.clientOf(payment.rawResponse);
    if (payment.status === 'PAID') return this.resultUrl(client, payment.orderId, 'success');

    if (kind === 'fail' || kind === 'cancel') {
      await this.markFailed(payment.id, 'FAILED', { kind, status: body.status ?? null });
      return this.resultUrl(client, payment.orderId, kind === 'cancel' ? 'cancelled' : 'failed');
    }
    if (!body.val_id) return this.resultUrl(client, payment.orderId, 'failed');
    const result = await this.sslcommerz.validate(body.val_id);
    if (
      result.success &&
      result.tranId === payment.id &&
      (result.amount === null || result.amount === payment.amount)
    ) {
      await this.markPaid(payment.id, result.trxId, result.raw);
      return this.resultUrl(client, payment.orderId, 'success');
    }
    await this.markFailed(payment.id, 'FAILED', result.raw);
    return this.resultUrl(client, payment.orderId, 'failed');
  }

  /**
   * Records a refund against the order's paid payment. Online payments are refunded through
   * the gateway; COD refunds are recorded as completed (cash/bank transfer handled offline).
   */
  async refund(orderId: string, amount: number, reason: string, actorId: string): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
      include: { refunds: true, order: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new BadRequestException('This order has no captured payment to refund');
    const refunded = payment.refunds.filter((r) => r.status !== 'FAILED').reduce((s, r) => s + r.amount, 0);
    if (amount > payment.amount - refunded) throw new BadRequestException('Refund exceeds the remaining paid amount');

    const gateway = this.gateway(payment.method);
    const result = gateway ? await gateway.refund(payment, amount, reason) : { success: true, gatewayRef: null };
    const status = result.success ? 'COMPLETED' : 'FAILED';

    await this.prisma.$transaction(async (tx) => {
      await tx.refund.create({
        data: { paymentId: payment.id, amount, reason, status, gatewayRef: result.gatewayRef, createdById: actorId },
      });
      if (!result.success) return;
      const fully = refunded + amount >= payment.amount;
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: fully ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: fully ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      });
      if (fully) {
        const subs = await tx.subOrder.findMany({ where: { orderId, status: { in: ['CANCELLED', 'RETURNED'] } } });
        for (const s of subs) {
          await this.status.transitionSubOrder(tx, s.id, 'REFUNDED', { actor: 'admin', actorId, note: reason });
        }
      }
    });
    if (!result.success)
      throw new BadRequestException('The payment gateway rejected the refund. It was logged as failed.');
    await this.notifications.notify(
      payment.order.userId,
      'PAYMENT',
      'Refund processed',
      `A refund for order ${payment.order.orderNumber} has been processed.`,
      { orderId },
    );
  }
}
