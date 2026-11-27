import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MessagingSettingsView, OrderSummary } from '@marketbd/shared';
import { MailService, type MailMessage } from '../src/modules/notifications/mail.service.js';
import { OrderMessagesService } from '../src/modules/notifications/order-messages.service.js';
import { SmsService } from '../src/modules/notifications/sms.service.js';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
}

describe('Order emails and SMS (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let customer: string;
  let server: Server;
  const sms: Array<Record<string, string>> = [];
  const mails: MailMessage[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    customer = await login(ctx, 'customer@marketbd.example', 'Customer@12345');
    await setMultiVendor(ctx, admin, true);
    // Fake bulk-SMS gateway
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        sms.push(Object.fromEntries(new URLSearchParams(body)));
        res.end('ok');
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const gateway = ctx.app.get(SmsService);
    gateway.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/sms`;
    gateway.apiKey = 'test-key';
    vi.spyOn(ctx.app.get(MailService), 'send').mockImplementation(async (m) => void mails.push(m));
  });

  afterAll(async () => {
    await ctx.http().put(`${API}/admin/settings/messaging`).set(auth(admin)).send({ orderEmailsEnabled: true, orderSmsEnabled: false, orderSmsEvents: ['PLACED', 'SHIPPED', 'DELIVERED'] });
    server.close();
    await ctx.app.close();
  });

  const waitFor = async (cond: () => boolean) => {
    for (let i = 0; i < 50 && !cond(); i++) await new Promise((r) => setTimeout(r, 100));
    return cond();
  };

  it('emails and texts the customer on the events the admin picked', async () => {
    const saved = ((await ctx.http().put(`${API}/admin/settings/messaging`).set(auth(admin)).send({ orderEmailsEnabled: true, orderSmsEnabled: true, orderSmsEvents: ['PLACED', 'DELIVERED'] }).expect(200)).body as Envelope<MessagingSettingsView>).data;
    expect(saved).toMatchObject({ orderEmailsEnabled: true, orderSmsEnabled: true, orderSmsEvents: ['PLACED', 'DELIVERED'], smsReady: true });

    // Place a COD order
    const address = await ctx.prisma.address.findFirstOrThrow({ where: { user: { email: 'customer@marketbd.example' } } });
    const variant = await ctx.prisma.productVariant.findFirstOrThrow({
      where: { isActive: true, stock: { gte: 5 }, flashSaleItems: { none: {} }, product: { status: 'ACTIVE', seller: { isHouseStore: true } } },
    });
    await ctx.prisma.cartItem.deleteMany({ where: { cart: { user: { email: 'customer@marketbd.example' } } } });
    await ctx.http().post(`${API}/cart/items`).set(auth(customer)).send({ variantId: variant.id, quantity: 1 }).expect(201);
    const placed = ((await ctx.http().post(`${API}/orders`).set(auth(customer)).send({ addressId: address.id, paymentMethod: 'COD' }).expect(201)).body as Envelope<{ order: OrderSummary }>).data.order;

    expect(await waitFor(() => mails.some((m) => m.subject.includes(placed.orderNumber)) && sms.length > 0)).toBe(true);
    const mail = mails.find((m) => m.subject.includes(placed.orderNumber))!;
    expect(mail.to).toBe('customer@marketbd.example');
    expect(mail.subject).toContain('Thanks for your order');
    expect(mail.html).toContain(`/account/orders/${placed.id}`);
    expect(sms[0]).toMatchObject({ api_key: 'test-key', number: address.phone.replace(/^\+/, '') });
    expect(sms[0]!.message).toContain(placed.orderNumber);
    expect(sms[0]!.message).toContain('pay on delivery');
    expect(sms[0]!.message).not.toContain('৳');

    // SHIPPED is not in the SMS list: email only
    const messages = ctx.app.get(OrderMessagesService);
    expect(await messages.send(placed.id, 'SHIPPED')).toEqual({ email: true, sms: false });
    expect(await messages.send(placed.id, 'DELIVERED')).toEqual({ email: true, sms: true });

    // Switched off: nothing goes out
    await ctx.http().put(`${API}/admin/settings/messaging`).set(auth(admin)).send({ orderEmailsEnabled: false, orderSmsEnabled: false, orderSmsEvents: [] }).expect(200);
    expect(await messages.send(placed.id, 'CANCELLED')).toEqual({ email: false, sms: false });

    // Test send and validation
    const test = ((await ctx.http().post(`${API}/admin/settings/messaging/test`).set(auth(admin)).send({ channel: 'sms', to: '01711000000' }).expect(201)).body as Envelope<{ delivered: boolean }>).data;
    expect(test.delivered).toBe(true);
    expect(sms.at(-1)?.number).toBe('8801711000000');
    await ctx.http().post(`${API}/admin/settings/messaging/test`).set(auth(admin)).send({ channel: 'email', to: 'not-an-email' }).expect(400);
    await ctx.http().put(`${API}/admin/settings/messaging`).set(auth(customer)).send({ orderEmailsEnabled: true, orderSmsEnabled: true, orderSmsEvents: [] }).expect(403);
  });
});
