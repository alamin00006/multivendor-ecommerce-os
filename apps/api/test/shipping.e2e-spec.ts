import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CourierAccountView, CourierOption, SellerOrderView, ShipmentView } from '@marketbd/shared';
import { PathaoAdapter } from '../src/modules/shipping/couriers/pathao.adapter.js';
import { SteadfastAdapter } from '../src/modules/shipping/couriers/steadfast.adapter.js';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
}

describe('Couriers: Pathao + Steadfast (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let gadget: string;
  let deshi: string;
  let server: Server;
  const orderIds: string[] = [];
  const pathaoOrders: Array<Record<string, unknown>> = [];
  const steadfastOrders: Array<{ body: Record<string, unknown>; headers: IncomingMessage['headers'] }> = [];
  let storeName = '';
  let nextId = 1000;
  let pathaoInfo = 'In_Transit';
  let steadfastStatus = 'in_review';
  let original: { variantId: string; stock: number; soldCount: number; productId: string } | null = null;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };
  const readBody = (req: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve) => {
      let raw = '';
      req.on('data', (c: Buffer) => (raw += c.toString()));
      req.on('end', () => resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {}));
    });

  /** A pending Gadget Ghor COD package with 2 units. */
  const pendingOrder = async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'customer@marketbd.example' } });
    const seller = await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { slug: 'gadget-ghor' } });
    const variant = await ctx.prisma.productVariant.findFirstOrThrow({
      where: { product: { sellerId: seller.id, status: 'ACTIVE' }, isActive: true },
      orderBy: { sku: 'asc' },
      include: { product: true },
    });
    original ??= { variantId: variant.id, stock: variant.stock, soldCount: variant.product.soldCount, productId: variant.productId };
    const total = variant.price * 2 + 6000;
    const order = await ctx.prisma.order.create({
      data: {
        orderNumber: `TEST-SHIP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        userId: user.id,
        paymentMethod: 'COD',
        shippingZone: 'INSIDE_DHAKA',
        shippingAddress: { fullName: 'Arif Rahman', phone: '+8801700000001', addressLine: 'House 5, Road 1', area: 'Gulshan', district: 'Dhaka', division: 'Dhaka' },
        subtotal: variant.price * 2,
        shippingFee: 6000,
        total,
        subOrders: { create: { sellerId: seller.id, subtotal: variant.price * 2, shippingFee: 6000, total, commissionRate: 10, commissionAmount: Math.round(variant.price / 5) } },
      },
      include: { subOrders: true },
    });
    const sub = order.subOrders[0]!;
    await ctx.prisma.orderItem.create({
      data: { orderId: order.id, subOrderId: sub.id, productId: variant.productId, variantId: variant.id, title: variant.product.title, variantLabel: 'Default', sku: variant.sku, unitPrice: variant.price, quantity: 2, lineTotal: variant.price * 2 },
    });
    orderIds.push(order.id);
    return { order, sub, variant, total };
  };

  const confirmed = async () => {
    const o = await pendingOrder();
    await ctx.http().patch(`${API}/seller/orders/${o.sub.id}/status`).set(auth(gadget)).send({ status: 'CONFIRMED' }).expect(200);
    return o;
  };
  const accounts = async () => ((await ctx.http().get(`${API}/admin/couriers`).set(auth(admin)).expect(200)).body as Envelope<CourierAccountView[]>).data;
  const subStatus = async (id: string) => (await ctx.prisma.subOrder.findUniqueOrThrow({ where: { id } })).status;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    gadget = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    deshi = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
    await ctx.prisma.courierAccount.deleteMany({});

    // One fake server for both couriers: /pathao/* and /steadfast/*.
    server = createServer((req, res) => {
      void (async () => {
        const url = req.url ?? '';
        const body = await readBody(req);
        if (url.startsWith('/steadfast/')) {
          if (req.headers['api-key'] !== 'sf-key' || req.headers['secret-key'] !== 'sf-secret') return send(res, 401, { message: 'Unauthenticated' });
          const path = url.slice('/steadfast'.length);
          if (path === '/get_balance') return send(res, 200, { status: 200, current_balance: 4820 });
          if (path === '/create_order') {
            steadfastOrders.push({ body, headers: req.headers });
            const id = ++nextId;
            return send(res, 200, { status: 200, message: 'Consignment has been created successfully.', consignment: { consignment_id: id, invoice: body.invoice, tracking_code: `SF${id}TC`, status: 'in_review' } });
          }
          if (path.startsWith('/status_by_cid/')) return send(res, 200, { status: 200, delivery_status: steadfastStatus });
          return send(res, 404, { message: 'Not found' });
        }
        const path = url.slice('/pathao'.length);
        if (path === '/aladdin/api/v1/issue-token') {
          if (body.client_secret !== 'pa-secret') return send(res, 401, { message: 'Invalid client' });
          return send(res, 200, { token_type: 'Bearer', access_token: 'tok-1', refresh_token: 'ref-1', expires_in: 3600 });
        }
        if (req.headers.authorization !== 'Bearer tok-1') return send(res, 401, { message: 'Unauthorized' });
        if (path === '/aladdin/api/v1/countries/1/city-list') return send(res, 200, { code: 200, data: { data: [{ city_id: 1, city_name: 'Dhaka' }] } });
        if (path === '/aladdin/api/v1/stores' && req.method === 'POST') {
          storeName = String(body.name);
          return send(res, 200, { code: 200, message: 'Store created successfully, Please wait one hour for approval.', data: { store_name: storeName } });
        }
        if (path.startsWith('/aladdin/api/v1/stores?page=')) {
          return send(res, 200, { code: 200, data: { data: [{ store_id: 999, store_name: 'Other' }, { store_id: 77, store_name: storeName }], last_page: 1 } });
        }
        if (path === '/aladdin/api/v1/orders' && req.method === 'POST') {
          pathaoOrders.push(body);
          return send(res, 200, { code: 200, data: { consignment_id: `DL${++nextId}`, merchant_order_id: body.merchant_order_id, order_status: 'Pending', delivery_fee: 60 } });
        }
        const info = /^\/aladdin\/api\/v1\/orders\/([^/]+)\/info$/.exec(path);
        if (info) return send(res, 200, { code: 200, data: { consignment_id: info[1], order_status_slug: pathaoInfo, updated_at: new Date().toISOString() } });
        return send(res, 404, { message: 'Not found' });
      })();
    });
    await new Promise<void>((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    ctx.app.get(PathaoAdapter).baseUrlOverride = `${base}/pathao`;
    ctx.app.get(SteadfastAdapter).baseUrlOverride = `${base}/steadfast`;
  });

  afterAll(async () => {
    await ctx.prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await ctx.prisma.courierStore.deleteMany({ where: { seller: { slug: 'gadget-ghor' } } });
    await ctx.prisma.courierAccount.deleteMany({});
    if (original) {
      await ctx.prisma.productVariant.update({ where: { id: original.variantId }, data: { stock: original.stock } });
      await ctx.prisma.product.update({ where: { id: original.productId }, data: { soldCount: original.soldCount } });
    }
    server.close();
    await ctx.app.close();
  });

  it('lets the admin add couriers with encrypted credentials', async () => {
    const before = await accounts();
    expect(before.map((a) => [a.provider, a.enabled])).toEqual([['PATHAO', false], ['STEADFAST', false]]);
    await ctx.http().get(`${API}/admin/couriers`).set(auth(gadget)).expect(403);

    // Cannot enable without credentials; sellers see no couriers yet.
    await ctx.http().put(`${API}/admin/couriers/pathao`).set(auth(admin)).send({ enabled: true, credentials: {} }).expect(400);
    expect(((await ctx.http().get(`${API}/seller/couriers`).set(auth(gadget)).expect(200)).body as Envelope<CourierOption[]>).data).toEqual([]);

    const creds = { clientId: 'pa-id', clientSecret: 'wrong', username: 'ops@marketbd.example', password: 'pa-pass' };
    await ctx.http().put(`${API}/admin/couriers/pathao`).set(auth(admin)).send({ enabled: true, sandbox: true, credentials: creds }).expect(200);
    await ctx.http().post(`${API}/admin/couriers/pathao/test`).set(auth(admin)).expect(502);
    // Blank fields keep their saved value; only the secret changes.
    const saved = ((await ctx.http().put(`${API}/admin/couriers/pathao`).set(auth(admin)).send({ enabled: true, sandbox: true, credentials: { clientSecret: 'pa-secret', password: '' } }).expect(200)).body as Envelope<CourierAccountView>).data;
    expect(saved).toMatchObject({ enabled: true, sandbox: true, credentials: { clientId: 'pa-id', clientSecret: null, username: 'ops@marketbd.example', password: null } });
    expect(saved.configured.sort()).toEqual(['clientId', 'clientSecret', 'password', 'username']);
    expect(saved.webhookUrl).toMatch(/\/api\/v1\/webhooks\/pathao$/);
    const test = (await ctx.http().post(`${API}/admin/couriers/pathao/test`).set(auth(admin)).expect(200)).body as Envelope<{ message: string }>;
    expect(test.data.message).toBe('Signed in to Pathao');

    const row = await ctx.prisma.courierAccount.findUniqueOrThrow({ where: { provider: 'PATHAO' } });
    expect(row.credentials).not.toContain('pa-secret');
    expect(row.credentials).not.toContain('pa-pass');

    await ctx.http().put(`${API}/admin/couriers/steadfast`).set(auth(admin)).send({ enabled: true, sandbox: true, credentials: { apiKey: 'sf-key', secretKey: 'sf-secret' } }).expect(200);
    const sf = (await accounts()).find((a) => a.provider === 'STEADFAST')!;
    expect(sf.sandbox).toBe(false); // Steadfast has no sandbox
    const sfTest = (await ctx.http().post(`${API}/admin/couriers/steadfast/test`).set(auth(admin)).expect(200)).body as Envelope<{ message: string }>;
    expect(sfTest.data.message).toContain('4820');
  });

  it('books Pathao from the seller pickup store and follows webhooks to delivery', async () => {
    const options = ((await ctx.http().get(`${API}/seller/couriers`).set(auth(gadget)).expect(200)).body as Envelope<CourierOption[]>).data;
    expect(options.map((o) => [o.provider, o.ready])).toEqual([['PATHAO', false], ['STEADFAST', true]]);

    const cities = (await ctx.http().get(`${API}/couriers/pathao/cities`).set(auth(gadget)).expect(200)).body as Envelope<unknown>;
    expect(cities.data).toEqual([{ id: 1, name: 'Dhaka' }]);
    await ctx.http().get(`${API}/couriers/steadfast/cities`).set(auth(gadget)).expect(400);

    const store = { contactName: 'Gadget Ghor', contactNumber: '01711111111', address: 'Shop 12, Bashundhara City, Panthapath', cityId: 1, zoneId: 2, areaId: 3 };
    const after = ((await ctx.http().put(`${API}/seller/couriers/pathao/store`).set(auth(gadget)).send(store).expect(200)).body as Envelope<CourierOption[]>).data;
    expect(after.find((o) => o.provider === 'PATHAO')).toMatchObject({ ready: true, store: { contactNumber: '+8801711111111' } });

    const { sub, total } = await pendingOrder();
    await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment`).set(auth(gadget)).send({ provider: 'PATHAO' }).expect(400); // not confirmed
    await ctx.http().patch(`${API}/seller/orders/${sub.id}/status`).set(auth(gadget)).send({ status: 'CONFIRMED' }).expect(200);
    await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment`).set(auth(deshi)).send({ provider: 'PATHAO' }).expect(404);

    const booked = ((await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment`).set(auth(gadget)).send({ provider: 'PATHAO', itemWeight: 1 }).expect(201)).body as Envelope<ShipmentView>).data;
    expect(booked).toMatchObject({ provider: 'PATHAO', active: true, codAmount: total, deliveryFee: 6000 });
    expect(pathaoOrders.at(-1)).toMatchObject({ store_id: 77, recipient_phone: '01700000001', recipient_address: 'House 5, Road 1, Gulshan, Dhaka', item_quantity: 2, item_weight: 1, amount_to_collect: Math.round(total / 100) });
    const view = ((await ctx.http().get(`${API}/seller/orders/${sub.id}`).set(auth(gadget)).expect(200)).body as Envelope<SellerOrderView>).data;
    expect(view).toMatchObject({ status: 'PROCESSING', trackingNumber: booked.consignmentId, shipment: { consignmentId: booked.consignmentId } });
    await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment`).set(auth(gadget)).send({ provider: 'STEADFAST' }).expect(409);

    const secret = (await accounts()).find((a) => a.provider === 'PATHAO')!.webhookSecret;
    const hook = (b: Record<string, unknown>, sig: string | null = secret) => {
      const r = ctx.http().post(`${API}/webhooks/pathao`);
      if (sig) r.set('X-PATHAO-Signature', sig);
      return r.send(b);
    };
    const hs = await hook({ event: 'webhook_integration' }, null).expect(202);
    expect(hs.headers['x-pathao-merchant-webhook-integration-secret']).toBeTruthy();
    await hook({ event: 'order.picked', consignment_id: booked.consignmentId }, null).expect(401);
    await hook({ event: 'order.picked', consignment_id: booked.consignmentId }, 'wrong').expect(401);
    await ctx.http().post(`${API}/webhooks/unknown`).send({}).expect(404);

    await hook({ event: 'order.picked', consignment_id: booked.consignmentId, updated_at: '2026-11-22T10:00:00Z' }).expect(202);
    expect(await subStatus(sub.id)).toBe('SHIPPED');
    await hook({ event: 'order.pickup-cancelled', consignment_id: booked.consignmentId, updated_at: '2026-11-22T09:00:00Z' }).expect(202); // stale
    expect((await ctx.prisma.shipment.findUniqueOrThrow({ where: { id: booked.id } })).active).toBe(true);
    await hook({ event: 'order.delivered', consignment_id: booked.consignmentId, updated_at: '2026-11-22T12:00:00Z', collected_amount: 1500 }).expect(202);
    expect(await subStatus(sub.id)).toBe('DELIVERED');
    expect(await ctx.prisma.order.findUniqueOrThrow({ where: { id: sub.orderId } })).toMatchObject({ status: 'DELIVERED', paymentStatus: 'PAID' });
    expect((await ctx.prisma.shipment.findUniqueOrThrow({ where: { id: booked.id } })).collectedAmount).toBe(150_000);
  });

  it('syncs Pathao; a returned parcel cancels the package and restores stock', async () => {
    const { sub, variant } = await confirmed();
    await ctx.http().post(`${API}/admin/orders/${sub.orderId}/sub-orders/${sub.id}/shipment`).set(auth(admin)).send({ provider: 'PATHAO' }).expect(201);
    pathaoInfo = 'In_Transit';
    const s1 = ((await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment/sync`).set(auth(gadget)).expect(200)).body as Envelope<ShipmentView>).data;
    expect(s1.courierStatus).toBe('In_Transit');
    expect(await subStatus(sub.id)).toBe('SHIPPED');

    const stockBefore = (await ctx.prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock;
    pathaoInfo = 'Return';
    await ctx.http().post(`${API}/admin/orders/${sub.orderId}/sub-orders/${sub.id}/shipment/sync`).set(auth(admin)).expect(200);
    expect(await subStatus(sub.id)).toBe('CANCELLED');
    expect((await ctx.prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(stockBefore + 2);
  });

  it('books Steadfast without a store; a cancellation before pickup lets the seller rebook', async () => {
    const { sub, total } = await confirmed();
    const first = ((await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment`).set(auth(gadget)).send({ provider: 'STEADFAST', specialInstruction: 'Call first' }).expect(201)).body as Envelope<ShipmentView>).data;
    expect(first).toMatchObject({ provider: 'STEADFAST', trackingCode: `SF${first.consignmentId}TC` });
    expect(steadfastOrders.at(-1)!.body).toMatchObject({ recipient_phone: '01700000001', cod_amount: Math.round(total / 100), note: 'Call first' });
    expect((await ctx.prisma.subOrder.findUniqueOrThrow({ where: { id: sub.id } })).trackingNumber).toBe(first.trackingCode);

    // Steadfast cancels while the parcel is still at the shop → booking ends, package stays.
    steadfastStatus = 'cancelled';
    const synced = ((await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment/sync`).set(auth(gadget)).expect(200)).body as Envelope<ShipmentView>).data;
    expect(synced.active).toBe(false);
    expect(await subStatus(sub.id)).toBe('PROCESSING');

    const second = ((await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment`).set(auth(gadget)).send({ provider: 'STEADFAST' }).expect(201)).body as Envelope<ShipmentView>).data;
    expect(second.merchantOrderId).toMatch(/-2$/);

    const secret = (await accounts()).find((a) => a.provider === 'STEADFAST')!.webhookSecret;
    const payload = { notification_type: 'delivery_status', consignment_id: Number(second.consignmentId), invoice: second.merchantOrderId, status: 'delivered', cod_amount: Math.round(total / 100), delivery_charge: 60, updated_at: '2026-11-22T12:00:00Z' };
    await ctx.http().post(`${API}/webhooks/steadfast`).set('Authorization', 'Bearer wrong').send(payload).expect(401);
    await ctx.http().post(`${API}/webhooks/steadfast`).set('Authorization', `Bearer ${secret}`).send(payload).expect(200);
    expect(await subStatus(sub.id)).toBe('DELIVERED');
    expect(await ctx.prisma.shipment.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({ deliveryFee: 6000, collectedAmount: Math.round(total / 100) * 100 });

    // Switching a courier off stops new bookings.
    await ctx.http().put(`${API}/admin/couriers/steadfast`).set(auth(admin)).send({ enabled: false, credentials: {} }).expect(200);
    const { sub: next } = await confirmed();
    await ctx.http().post(`${API}/seller/orders/${next.id}/shipment`).set(auth(gadget)).send({ provider: 'STEADFAST' }).expect(400);
  });
});
