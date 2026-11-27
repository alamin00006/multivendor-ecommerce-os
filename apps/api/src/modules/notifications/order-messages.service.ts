import { Injectable, Logger } from '@nestjs/common';
import { BRAND, formatBDT, ORDER_MESSAGE_EVENTS, type OrderMessageEvent } from '@marketbd/shared';
import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { MailService } from './mail.service.js';
import { SmsService } from './sms.service.js';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** SMS stays in the GSM alphabet (one cheap part per 160 chars), so "Tk" instead of "৳". */
const tk = (poisha: number) => formatBDT(poisha).replace('৳', 'Tk ');

const HEADLINE: Record<OrderMessageEvent, string> = {
  PLACED: 'Thanks for your order!',
  PAID: 'Payment received',
  SHIPPED: 'Your package is on the way',
  DELIVERED: 'Your package was delivered',
  CANCELLED: 'Your order was cancelled',
  REFUNDED: 'Your refund is on its way',
};

interface Extra {
  /** The package the event is about (shipped / delivered). */
  subOrderId?: string;
  /** Refunded amount in poisha. */
  amount?: number;
}

/**
 * Order updates to the customer by email (account email) and SMS (delivery phone), on top of the
 * in-app notification. Admin → Settings → Messages switches them on/off. Never throws: a failed
 * email or SMS must not fail the order action that triggered it.
 */
@Injectable()
export class OrderMessagesService {
  private readonly logger = new Logger('OrderMessages');

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  /** Email/SMS for an order status change (only the statuses customers care about). */
  statusChanged(orderId: string, status: string, subOrderId?: string): void {
    const event = ({ SHIPPED: 'SHIPPED', DELIVERED: 'DELIVERED', CANCELLED: 'CANCELLED' } as const)[status as 'SHIPPED'];
    if (event) this.notify(orderId, event, { subOrderId });
  }

  /** Fire and forget. */
  notify(orderId: string, event: OrderMessageEvent, extra: Extra = {}): void {
    void this.send(orderId, event, extra).catch((e: unknown) => this.logger.warn(`Order message ${event} for ${orderId} failed: ${String(e)}`));
  }

  /** Sends now; resolves to what was sent (used by tests). */
  async send(orderId: string, event: OrderMessageEvent, extra: Extra = {}): Promise<{ email: boolean; sms: boolean }> {
    const [settings, order] = await Promise.all([
      this.settings.get(),
      this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { name: true, email: true } },
          items: { select: { title: true, variantLabel: true, quantity: true, lineTotal: true, subOrderId: true } },
          subOrders: { select: { id: true, trackingNumber: true, courierName: true, total: true, seller: { select: { shopName: true } } } },
        },
      }),
    ]);
    if (!order || order.channel === 'POS') return { email: false, sms: false };
    const address = order.shippingAddress as { fullName?: string; phone?: string; addressLine?: string; area?: string; district?: string };
    const pkg = extra.subOrderId ? order.subOrders.find((s) => s.id === extra.subOrderId) : undefined;
    const items = pkg ? order.items.filter((i) => i.subOrderId === pkg.id) : order.items;
    const link = `${env.WEB_URL.replace(/\/$/, '')}/account/orders/${order.id}`;
    const name = address.fullName || order.user.name;
    const tracking = pkg?.trackingNumber ? `${pkg.courierName ?? 'Courier'} tracking: ${pkg.trackingNumber}` : null;

    /** One-sentence summary; `money` formats amounts (৳ in email, Tk in SMS). */
    const lineFor = (money: (poisha: number) => string): Record<OrderMessageEvent, string> => ({
      PLACED: `Order ${order.orderNumber} placed. Total ${money(order.total)}${order.paymentMethod === 'COD' ? ', pay on delivery' : ''}.`,
      PAID: `Payment of ${money(order.total)} received for order ${order.orderNumber}.`,
      SHIPPED: `Order ${order.orderNumber}${order.subOrders.length > 1 && pkg ? ` (${pkg.seller.shopName})` : ''} is on the way.${tracking ? ` ${tracking}.` : ''}`,
      DELIVERED: `Order ${order.orderNumber}${order.subOrders.length > 1 && pkg ? ` (${pkg.seller.shopName})` : ''} was delivered. Thank you for shopping with ${BRAND.name}!`,
      CANCELLED: `Order ${order.orderNumber} was cancelled.${order.paymentStatus === 'PAID' ? ' Any payment will be refunded.' : ''}`,
      REFUNDED: `Refund${extra.amount ? ` of ${money(extra.amount)}` : ''} for order ${order.orderNumber} has been sent.`,
    });
    const line = lineFor(formatBDT);

    let email = false;
    let sms = false;
    if (settings.orderEmailsEnabled && order.user.email) {
      const rows = items
        .map(
          (i) =>
            `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(i.title)}${i.variantLabel && i.variantLabel !== 'Default' ? ` <span style="color:#777">(${esc(i.variantLabel)})</span>` : ''} × ${i.quantity}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${formatBDT(i.lineTotal)}</td></tr>`,
        )
        .join('');
      const color = settings.brandPrimary;
      const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#222">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="background:${color};color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-size:20px;font-weight:bold">${esc(BRAND.name)}</div>
  <div style="background:#fff;padding:20px;border-radius:0 0 10px 10px">
    <h1 style="font-size:20px;margin:0 0 8px">${HEADLINE[event]}</h1>
    <p style="margin:0 0 16px">Hi ${esc(name)}, ${esc(line[event])}</p>
    ${event === 'REFUNDED' || event === 'PAID' ? '' : `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}<tr><td style="padding:8px 0;font-weight:bold">Order total</td><td style="padding:8px 0;text-align:right;font-weight:bold">${formatBDT(order.total)}</td></tr></table>`}
    ${event === 'PLACED' ? `<p style="font-size:13px;color:#555;margin:16px 0 0">Delivery to: ${esc([address.addressLine, address.area, address.district].filter(Boolean).join(', '))}</p>` : ''}
    <p style="margin:20px 0 0"><a href="${link}" style="background:${color};color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">View your order</a></p>
  </div>
  <p style="font-size:12px;color:#888;text-align:center;margin-top:16px">Questions? ${esc(settings.supportPhone)} · ${esc(settings.supportEmail)}</p>
</div></body></html>`;
      const text = `Hi ${name},\n\n${line[event]}\n\n${items.map((i) => `- ${i.title} x ${i.quantity}: ${formatBDT(i.lineTotal)}`).join('\n')}\n\nView your order: ${link}\n\n${BRAND.name} · ${settings.supportPhone}`;
      try {
        await this.mail.send({ to: order.user.email, subject: `${HEADLINE[event]} · Order ${order.orderNumber}`, text, html });
        email = true;
      } catch (e) {
        this.logger.warn(`Email for ${order.orderNumber} failed: ${String(e)}`);
      }
    }
    if (settings.orderSmsEnabled && settings.orderSmsEvents.includes(event) && address.phone) {
      try {
        await this.sms.send(address.phone, `${BRAND.name}: ${lineFor(tk)[event]}`);
        sms = true;
      } catch (e) {
        this.logger.warn(`SMS for ${order.orderNumber} failed: ${String(e)}`);
      }
    }
    return { email, sms };
  }

  /** Admin settings view. */
  async messagingSettings() {
    const s = await this.settings.get();
    return {
      orderEmailsEnabled: s.orderEmailsEnabled,
      orderSmsEnabled: s.orderSmsEnabled,
      orderSmsEvents: s.orderSmsEvents.filter((e) => (ORDER_MESSAGE_EVENTS as readonly string[]).includes(e)),
      emailReady: this.mail.ready,
      smsReady: this.sms.ready,
      mailFrom: this.mail.from,
    };
  }
}
