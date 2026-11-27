import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CourierOption, SellerCourierAccountView, SellerOrderView, ShipmentView } from '@marketbd/shared';
import { SteadfastAdapter } from '../src/modules/shipping/couriers/steadfast.adapter.js';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Own delivery, step 2: a shop connects its own Steadfast account, books parcels on it and receives
 * status updates on its own webhook URL. A fake Steadfast checks which account's keys were used.
 */
describe("Shop's own courier account (e2e)", () => {
  let ctx: TestContext;
  let admin: string;
  let deshi: string;
  let gadget: string;
  let deshiId: string;
  let gadgetId: string;
  let server: Server;
  let nextId = 5000;
  let status = 'in_review';
  const calls: Array<{ path: string; apiKey: string | undefined; body: Record<string, unknown> }> = [];
  const orderIds: string[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const body = <T>(res: { body: unknown }) => (res.body as Envelope<T>).data;
  const send = (res: ServerResponse, code: number, data: unknown) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(data));
  };
  const readBody = (req: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve) => {
      let raw = '';
      req.on('data', (c: Buffer) => (raw += c.toString()));
      req.on('end', () => resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {}));
    });

  /** A confirmed COD package of `sellerId`, delivered by the shop itself (own delivery). */
  const ownPackage = async (sellerId: string) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'customer@marketbd.example' } });
    const variant = await ctx.prisma.productVariant.findFirstOrThrow({ where: { product: { sellerId, status: 'ACTIVE' }, isActive: true }, orderBy: { sku: 'asc' }, include: { product: true } });
    const total = variant.price + 5000;
    const order = await ctx.prisma.order.create({
      data: {
        orderNumber: `TEST-OWN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        userId: user.id,
        status: 'CONFIRMED',
        paymentMethod: 'COD',
        shippingZone: 'INSIDE_DHAKA',
        shippingAddress: { fullName: 'Arif Rahman', phone: '+8801700000001', addressLine: 'House 5, Road 1', area: 'Gulshan', district: 'Dhaka', division: 'Dhaka' },
        subtotal: variant.price,
        shippingFee: 5000,
        total,
        subOrders: {
          create: { sellerId, status: 'CONFIRMED', subtotal: variant.price, shippingFee: 5000, total, commissionRate: 10, commissionAmount: Math.round(variant.price / 10), fulfillment: 'SELLER', courierName: 'Steadfast', sellerCollectsCash: true },
        },
      },
      include: { subOrders: true },
    });
    const sub = order.subOrders[0]!;
    await ctx.prisma.orderItem.create({
      data: { orderId: order.id, subOrderId: sub.id, productId: variant.productId, variantId: variant.id, title: variant.product.title, variantLabel: 'Default', sku: variant.sku, unitPrice: variant.price, quantity: 1, lineTotal: variant.price },
    });
    orderIds.push(order.id);
    return { order, sub, total };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    deshi = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    gadget = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
    deshiId = (await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { slug: 'deshi-bazar' } })).id;
    gadgetId = (await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { slug: 'gadget-ghor' } })).id;
    await ctx.prisma.sellerCourierAccount.deleteMany({});

    // Fake Steadfast: accepts the shop's keys (deshi-key / gadget-key) and records which one was used.
    server = createServer((req, res) => {
      void (async () => {
        const path = req.url ?? '';
        const reqBody = await readBody(req);
        const apiKey = req.headers['api-key'] as string | undefined;
        if (!['deshi-key', 'gadget-key'].includes(apiKey ?? '') || req.headers['secret-key'] !== 'shop-secret') return send(res, 401, { message: 'Unauthenticated' });
        calls.push({ path, apiKey, body: reqBody });
        if (path === '/get_balance') return send(res, 200, { status: 200, current_balance: 120 });
        if (path === '/create_order') {
          const id = ++nextId;
          return send(res, 200, { status: 200, consignment: { consignment_id: id, invoice: reqBody.invoice, tracking_code: `OWN${id}`, status: 'in_review' } });
        }
        if (path.startsWith('/status_by_cid/')) return send(res, 200, { status: 200, delivery_status: status });
        return send(res, 404, { message: 'Not found' });
      })();
    });
    await new Promise<void>((r) => server.listen(0, r));
    ctx.app.get(SteadfastAdapter).baseUrlOverride = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await ctx.prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await ctx.prisma.sellerCourierAccount.deleteMany({});
    server.close();
    await ctx.app.close();
  });

  it('a shop connects its own Steadfast account; keys are encrypted and each shop has its own webhook', async () => {
    const list = body<SellerCourierAccountView[]>(await ctx.http().get(`${API}/seller/own-couriers`).set(auth(deshi)).expect(200));
    expect(list.map((a) => a.provider)).toEqual(['PATHAO', 'STEADFAST']);
    await ctx.http().put(`${API}/seller/own-couriers/steadfast`).set(auth(deshi)).send({ enabled: true, credentials: { apiKey: 'deshi-key' } }).expect(400);
    // Pathao needs the shop's store id
    await ctx.http().put(`${API}/seller/own-couriers/pathao`).set(auth(deshi)).send({ enabled: true, credentials: { clientId: 'a', clientSecret: 'b', username: 'c', password: 'd' } }).expect(400);

    const saved = body<SellerCourierAccountView>(
      await ctx.http().put(`${API}/seller/own-couriers/steadfast`).set(auth(deshi)).send({ enabled: true, credentials: { apiKey: 'deshi-key', secretKey: 'shop-secret' } }).expect(200),
    );
    expect(saved).toMatchObject({ enabled: true, credentials: { apiKey: 'deshi-key', secretKey: null } });
    expect(saved.webhookUrl).toMatch(new RegExp(`/api/v1/webhooks/steadfast/shops/${deshiId}$`));
    const row = await ctx.prisma.sellerCourierAccount.findUniqueOrThrow({ where: { sellerId_provider: { sellerId: deshiId, provider: 'STEADFAST' } } });
    expect(row.credentials).not.toContain('shop-secret');

    expect(body<{ message: string }>(await ctx.http().post(`${API}/seller/own-couriers/steadfast/test`).set(auth(deshi)).expect(200)).message).toContain('120');
    const options = body<CourierOption[]>(await ctx.http().get(`${API}/seller/own-couriers/options`).set(auth(deshi)).expect(200));
    expect(options).toMatchObject([{ provider: 'STEADFAST', ready: true }]);

    // The platform's Steadfast account is untouched (still not set up).
    expect(await ctx.prisma.courierAccount.count({ where: { provider: 'STEADFAST' } })).toBe(0);
    await ctx.http().put(`${API}/seller/own-couriers/steadfast`).set(auth(gadget)).send({ enabled: true, credentials: { apiKey: 'gadget-key', secretKey: 'shop-secret' } }).expect(200);
  });

  it("books own-delivery parcels on the shop's account and follows them through the shop's webhook", async () => {
    const { sub, total } = await ownPackage(deshiId);
    const shipment = body<ShipmentView>(await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment`).set(auth(deshi)).send({ provider: 'STEADFAST' }).expect(201));
    const booking = calls.find((c) => c.path === '/create_order')!;
    expect(booking.apiKey).toBe('deshi-key'); // the shop's own key, not the platform's
    expect(booking.body.cod_amount).toBe(Math.round(total / 100));
    expect(shipment.trackingCode).toMatch(/^OWN/);

    const view = body<SellerOrderView>(await ctx.http().get(`${API}/seller/orders/${sub.id}`).set(auth(deshi)).expect(200));
    expect(view).toMatchObject({ status: 'PROCESSING', trackingNumber: shipment.trackingCode });
    const row = await ctx.prisma.shipment.findFirstOrThrow({ where: { subOrderId: sub.id } });
    expect(row.accountSellerId).toBe(deshiId);

    const secret = body<SellerCourierAccountView[]>(await ctx.http().get(`${API}/seller/own-couriers`).set(auth(deshi)).expect(200)).find((a) => a.provider === 'STEADFAST')!.webhookSecret;
    const gadgetSecret = body<SellerCourierAccountView[]>(await ctx.http().get(`${API}/seller/own-couriers`).set(auth(gadget)).expect(200)).find((a) => a.provider === 'STEADFAST')!.webhookSecret;
    const payload = { consignment_id: Number(row.consignmentId), status: 'delivered', cod_amount: Math.round(total / 100), delivery_charge: 60, updated_at: new Date().toISOString() };

    // Another shop's webhook (valid for that shop) cannot move this parcel; nor can the platform URL.
    await ctx.http().post(`${API}/webhooks/steadfast/shops/${gadgetId}`).set('Authorization', `Bearer ${gadgetSecret}`).send(payload).expect(200);
    await ctx.http().post(`${API}/webhooks/steadfast/shops/${deshiId}`).set('Authorization', `Bearer ${gadgetSecret}`).send(payload).expect(401);
    expect((await ctx.prisma.subOrder.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe('PROCESSING');

    await ctx.http().post(`${API}/webhooks/steadfast/shops/${deshiId}`).set('Authorization', `Bearer ${secret}`).send(payload).expect(200);
    expect((await ctx.prisma.subOrder.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe('DELIVERED');
    expect(await ctx.prisma.shipment.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ collectedAmount: Math.round(total / 100) * 100 });
  });

  it("status sync asks the courier with the shop's keys", async () => {
    const { sub } = await ownPackage(deshiId);
    await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment`).set(auth(deshi)).send({ provider: 'STEADFAST' }).expect(201);
    status = 'delivered';
    calls.length = 0;
    await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment/sync`).set(auth(deshi)).expect(200);
    expect(calls.find((c) => c.path.startsWith('/status_by_cid/'))?.apiKey).toBe('deshi-key');
    expect((await ctx.prisma.subOrder.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe('DELIVERED');
  });

  it('a shop without a connected account still ships by hand with a tracking number', async () => {
    await ctx.prisma.sellerCourierAccount.update({ where: { sellerId_provider: { sellerId: deshiId, provider: 'STEADFAST' } }, data: { enabled: false } });
    const { sub } = await ownPackage(deshiId);
    expect((await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment`).set(auth(deshi)).send({ provider: 'STEADFAST' }).expect(400)).body.message).toContain('Connect your Steadfast account');
    await ctx.http().patch(`${API}/seller/orders/${sub.id}/status`).set(auth(deshi)).send({ status: 'PROCESSING' }).expect(200);
    await ctx.http().patch(`${API}/seller/orders/${sub.id}/status`).set(auth(deshi)).send({ status: 'SHIPPED', trackingNumber: 'HAND-1' }).expect(200);
  });
});
