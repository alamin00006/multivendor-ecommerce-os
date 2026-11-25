import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CheckoutPreview, OpenDisputeView, OrderDetail, OwnDeliveryShopView, OwnDeliveryView, PlaceOrderResult, SellerEarnings, SellerOrderView } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const SELLER = 'deshibazar@marketbd.example';

describe('Own delivery: shop couriers, COD dues and delivery complaints (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let customer: string;
  let seller: string;
  let sellerId: string;
  let addressId: string;
  const orderIds: string[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const body = <T>(res: { body: unknown }) => (res.body as Envelope<T>).data;
  const preview = async (paymentMethod = 'COD') => body<CheckoutPreview>(await ctx.http().post(`${API}/checkout/preview`).set(auth(customer)).send({ addressId, paymentMethod }).expect(201));
  const earnings = async () => body<SellerEarnings>(await ctx.http().get(`${API}/seller/earnings`).set(auth(seller)).expect(200));
  /** One Deshi Bazar item in the cart. */
  const fillCart = async () => {
    await ctx.prisma.cartItem.deleteMany({ where: { cart: { user: { email: 'customer@marketbd.example' } } } });
    const variant = await ctx.prisma.productVariant.findFirstOrThrow({
      where: { isActive: true, stock: { gte: 5 }, flashSaleItems: { none: {} }, product: { status: 'ACTIVE', sellerId } },
      orderBy: { sku: 'asc' },
    });
    await ctx.http().post(`${API}/cart/items`).set(auth(customer)).send({ variantId: variant.id, quantity: 1 }).expect(201);
  };
  const deshiGroup = (p: CheckoutPreview) => p.groups.find((g) => g.seller?.id === sellerId)!;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    customer = await login(ctx, 'customer@marketbd.example', 'Customer@12345');
    seller = await login(ctx, SELLER, 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
    sellerId = (await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { user: { email: SELLER } } })).id;
    addressId = (await ctx.prisma.address.findFirstOrThrow({ where: { user: { email: 'customer@marketbd.example' }, isDefault: true } })).id;
  });

  afterAll(async () => {
    await ctx.http().patch(`${API}/admin/settings`).set(auth(admin)).send({ ownDeliveryDueLimit: 500000 });
    await ctx.prisma.sellerProfile.update({ where: { id: sellerId }, data: { ownDeliveryStatus: null, ownDelivery: null as never } });
    await ctx.prisma.sellerAdjustment.deleteMany({ where: { sellerId } });
    await ctx.prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await ctx.prisma.cartItem.deleteMany({ where: { cart: { user: { email: 'customer@marketbd.example' } } } });
    await ctx.app.close();
  });

  it('a shop asks to use its own courier; it only applies once admin approves', async () => {
    await fillCart();
    const before = deshiGroup(await preview());
    expect(before.delivery.by).toBe('PLATFORM');

    await ctx.http().put(`${API}/seller/own-delivery`).set(auth(seller)).send({ courier: 'OTHER', insideDhakaFee: 5000, outsideDhakaFee: 9000, insideDhakaEta: '1 day', outsideDhakaEta: '3 days' }).expect(400);
    const req = body<OwnDeliveryView>(
      await ctx.http().put(`${API}/seller/own-delivery`).set(auth(seller)).send({ courier: 'STEADFAST', insideDhakaFee: 5000, outsideDhakaFee: 9000, insideDhakaEta: '1 day', outsideDhakaEta: '2–3 days' }).expect(200),
    );
    expect(req.status).toBe('PENDING');
    expect(deshiGroup(await preview()).delivery.by).toBe('PLATFORM');

    const pending = body<OwnDeliveryShopView[]>(await ctx.http().get(`${API}/admin/own-delivery`).query({ status: 'PENDING' }).set(auth(admin)).expect(200));
    expect(pending.some((r) => r.seller.id === sellerId)).toBe(true);
    await ctx.http().patch(`${API}/admin/own-delivery/${sellerId}`).set(auth(admin)).send({ action: 'REJECT' }).expect(400); // needs a reason
    await ctx.http().patch(`${API}/admin/own-delivery/${sellerId}`).set(auth(admin)).send({ action: 'APPROVE' }).expect(200);

    const after = deshiGroup(await preview());
    expect(after.delivery).toMatchObject({ by: 'SHOP', courier: 'Steadfast' });
    expect([5000, 9000]).toContain(after.shippingFee);
  });

  it('COD with the shop courier: no platform booking, tracking required, commission comes off the balance', async () => {
    const start = await earnings();
    const placed = body<PlaceOrderResult>(await ctx.http().post(`${API}/orders`).set(auth(customer)).send({ addressId, paymentMethod: 'COD' }).expect(201));
    orderIds.push(placed.order.id);
    const sub = await ctx.prisma.subOrder.findFirstOrThrow({ where: { orderId: placed.order.id, sellerId } });
    expect(sub).toMatchObject({ fulfillment: 'SELLER', courierName: 'Steadfast', sellerCollectsCash: true });

    const move = (status: string, extra: Record<string, unknown> = {}) => ctx.http().patch(`${API}/seller/orders/${sub.id}/status`).set(auth(seller)).send({ status, ...extra });
    await move('CONFIRMED').expect(200);
    await ctx.http().post(`${API}/seller/orders/${sub.id}/shipment`).set(auth(seller)).send({ provider: 'STEADFAST' }).expect(400);
    await move('PROCESSING').expect(200);
    expect((await move('SHIPPED').expect(400)).body.message).toContain('Steadfast tracking number');
    const shipped = body<SellerOrderView>(await move('SHIPPED', { trackingNumber: 'SF123456' }).expect(200));
    expect(shipped).toMatchObject({ fulfillment: 'SELLER', courierName: 'Steadfast', sellerCollectsCash: true, trackingNumber: 'SF123456' });
    await move('DELIVERED').expect(200);

    const end = await earnings();
    expect(end.net - start.net).toBe(-sub.commissionAmount);
    expect(end.balance - start.balance).toBe(-sub.commissionAmount);

    const detail = body<OrderDetail>(await ctx.http().get(`${API}/orders/${placed.order.id}`).set(auth(customer)).expect(200));
    expect(detail.subOrders[0]).toMatchObject({ fulfillment: 'SELLER', courierName: 'Steadfast', trackingNumber: 'SF123456' });
  });

  it('pauses own-courier COD once the shop owes more than the limit, until it pays', async () => {
    await ctx.http().patch(`${API}/admin/settings`).set(auth(admin)).send({ ownDeliveryDueLimit: 0 }).expect(200);
    const { balance } = await earnings();
    expect(balance).toBeLessThan(0);
    const view = body<OwnDeliveryView>(await ctx.http().get(`${API}/seller/own-delivery`).set(auth(seller)).expect(200));
    expect(view.codPaused).toBe(true);

    await fillCart();
    const p = await preview();
    const cod = p.paymentMethods.find((m) => m.method === 'COD')!;
    expect(cod.enabled).toBe(false);
    expect(cod.note).toContain('Deshi Bazar');
    await ctx.http().post(`${API}/orders`).set(auth(customer)).send({ addressId, paymentMethod: 'COD' }).expect(400);

    await ctx.http().post(`${API}/admin/sellers/${sellerId}/adjustments`).set(auth(admin)).send({ amount: 0, note: 'x' }).expect(400);
    await ctx.http().post(`${API}/admin/sellers/${sellerId}/adjustments`).set(auth(admin)).send({ amount: -balance, note: 'Commission paid via bKash', reference: 'TRX9' }).expect(201);
    expect((await earnings()).balance).toBe(0);
    expect((await preview()).paymentMethods.find((m) => m.method === 'COD')?.enabled).toBe(true);
  });

  it('customer reports a package as not received; admin resolves it', async () => {
    const orderId = orderIds[0]!;
    const sub = await ctx.prisma.subOrder.findFirstOrThrow({ where: { orderId } });
    const url = `${API}/orders/${orderId}/packages/${sub.id}/not-received`;
    await ctx.http().post(url).set(auth(seller)).send({ note: 'Never came to my door' }).expect(404);
    await ctx.http().post(url).set(auth(customer)).send({ note: 'no' }).expect(400);
    await ctx.http().post(url).set(auth(customer)).send({ note: 'The parcel never came to my door' }).expect(201);
    await ctx.http().post(url).set(auth(customer)).send({ note: 'The parcel never came to my door' }).expect(409);

    const open = body<OpenDisputeView[]>(await ctx.http().get(`${API}/admin/delivery-disputes`).set(auth(admin)).expect(200));
    expect(open.find((d) => d.subOrderId === sub.id)).toMatchObject({ shopName: 'Deshi Bazar', trackingNumber: 'SF123456' });

    const before = await earnings();
    await ctx.http().post(`${API}/admin/orders/${orderId}/sub-orders/${sub.id}/dispute/resolve`).set(auth(admin)).send({ resolution: 'NOT_DELIVERED' }).expect(200);
    const after = await earnings();
    expect(after.net - before.net).toBe(sub.commissionAmount); // the package no longer counts
    const detail = body<OrderDetail>(await ctx.http().get(`${API}/orders/${orderId}`).set(auth(customer)).expect(200));
    expect(detail.subOrders[0]?.dispute).toMatchObject({ resolution: 'NOT_DELIVERED' });

    const stats = body<OwnDeliveryShopView[]>(await ctx.http().get(`${API}/admin/own-delivery`).set(auth(admin)).expect(200)).find((r) => r.seller.id === sellerId)!;
    expect(stats.stats).toMatchObject({ shipped: 1, delivered: 1, disputes: 1, openDisputes: 0 });
  });

  it('the shop can go back to MarketBD Delivery', async () => {
    expect(body<OwnDeliveryView>(await ctx.http().delete(`${API}/seller/own-delivery`).set(auth(seller)).expect(200)).status).toBeNull();
    await fillCart();
    expect(deshiGroup(await preview()).delivery.by).toBe('PLATFORM');
  });
});
