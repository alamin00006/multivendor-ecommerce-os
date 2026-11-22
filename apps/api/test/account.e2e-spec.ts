import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthUser, MyReturnView, OrderDetail, OrderSummary, ReturnableOrder, ReviewableItem, ReviewView } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
}

describe('Account overview data (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let customer: string;
  let seller: string;
  let addressId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    customer = await login(ctx, 'customer@marketbd.example', 'Customer@12345');
    seller = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
    addressId = (await ctx.prisma.address.findFirstOrThrow({ where: { user: { email: 'customer@marketbd.example' } } })).id;
    await ctx.prisma.cartItem.deleteMany({ where: { cart: { user: { email: 'customer@marketbd.example' } } } });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('exposes verification flags, shop names on orders, returns, and reviews to write', async () => {
    const me = await ctx.http().get(`${API}/users/me`).set(auth(customer)).expect(200);
    const user = (me.body as Envelope<AuthUser>).data;
    expect(typeof user.emailVerified).toBe('boolean');
    expect(typeof user.phoneVerified).toBe('boolean');

    // Buy a product nobody reviewed yet from Gadget Ghor, then deliver it.
    const product = await ctx.prisma.product.findFirstOrThrow({
      where: {
        status: 'ACTIVE',
        seller: { slug: 'gadget-ghor' },
        reviews: { none: { user: { email: 'customer@marketbd.example' } } },
        variants: { some: { isActive: true, stock: { gte: 3 }, flashSaleItems: { none: {} } } },
      },
      include: { variants: { where: { isActive: true, stock: { gte: 3 }, flashSaleItems: { none: {} } } } },
      orderBy: { slug: 'desc' },
    });
    await ctx.http().post(`${API}/cart/items`).set(auth(customer)).send({ variantId: product.variants[0]!.id, quantity: 1 }).expect(201);
    const placed = await ctx.http().post(`${API}/orders`).set(auth(customer)).send({ addressId, paymentMethod: 'COD' }).expect(201);
    const order = (placed.body as Envelope<{ order: OrderSummary }>).data.order;

    const list = await ctx.http().get(`${API}/orders?limit=5`).set(auth(customer)).expect(200);
    const summary = (list.body as Envelope<OrderSummary[]>).data.find((o) => o.id === order.id);
    expect(summary?.shopNames).toEqual(['Gadget Ghor']);

    // "To Pay" lists only unpaid online-payment orders: not this COD order, until it becomes an unpaid bKash order.
    const toPayIds = async () =>
      ((await ctx.http().get(`${API}/orders?toPay=true`).set(auth(customer)).expect(200)).body as Envelope<OrderSummary[]>).data.map((o) => o.id);
    expect(await toPayIds()).not.toContain(order.id);
    // A fresh order can still be cancelled; once a package ships it cannot.
    const cancellableIds = async () =>
      ((await ctx.http().get(`${API}/orders?cancellable=true`).set(auth(customer)).expect(200)).body as Envelope<OrderSummary[]>).data.map((o) => o.id);
    expect(await cancellableIds()).toContain(order.id);
    await ctx.prisma.order.update({ where: { id: order.id }, data: { paymentMethod: 'BKASH', paymentStatus: 'PENDING' } });
    expect(await toPayIds()).toContain(order.id);
    await ctx.prisma.order.update({ where: { id: order.id }, data: { paymentMethod: 'COD', paymentStatus: 'UNPAID' } });

    const detail = await ctx.http().get(`${API}/orders/${order.id}`).set(auth(customer)).expect(200);
    const subOrderId = (detail.body as Envelope<OrderDetail>).data.subOrders[0]!.id;
    for (const status of ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']) {
      await ctx.http().patch(`${API}/seller/orders/${subOrderId}/status`).set(auth(seller)).send({ status }).expect(200);
    }

    expect(await cancellableIds()).not.toContain(order.id);
    const pending = await ctx.http().get(`${API}/reviews/pending`).set(auth(customer)).expect(200);
    const toReview = (pending.body as Envelope<ReviewableItem[]>).data.find((i) => i.productId === product.id);
    expect(toReview).toMatchObject({ orderNumber: order.orderNumber });
    expect(toReview?.deliveredAt).not.toBeNull();

    await ctx.http().post(`${API}/reviews`).set(auth(customer)).send({ productId: product.id, rating: 5, comment: 'Great helmet' }).expect(201);
    const after = await ctx.http().get(`${API}/reviews/pending`).set(auth(customer)).expect(200);
    expect((after.body as Envelope<ReviewableItem[]>).data.some((i) => i.productId === product.id)).toBe(false);
    const mine = await ctx.http().get(`${API}/reviews/mine`).set(auth(customer)).expect(200);
    expect((mine.body as Envelope<ReviewView[]>).data[0]).toMatchObject({ rating: 5, product: { id: product.id }, isVerifiedPurchase: true });

    // Delivered and inside the window: offered under "Initiate Return" with its package.
    const returnable = ((await ctx.http().get(`${API}/orders/returnable`).set(auth(customer)).expect(200)).body as Envelope<ReturnableOrder[]>).data;
    const offered = returnable.find((o) => o.orderId === order.id);
    expect(offered?.packages[0]).toMatchObject({ subOrderId, shopName: 'Gadget Ghor' });
    expect(new Date(offered!.returnBy!).getTime()).toBeGreaterThan(Date.now());

    await ctx.http().post(`${API}/orders/${order.id}/returns`).set(auth(customer)).send({ reason: 'Wrong size delivered' }).expect(201);
    const returns = await ctx.http().get(`${API}/returns`).set(auth(customer)).expect(200);
    expect((returns.body as Envelope<MyReturnView[]>).data[0]).toMatchObject({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'REQUESTED',
      shopName: 'Gadget Ghor',
      items: [expect.objectContaining({ title: product.title, quantity: 1 })],
    });
    // Once requested it is no longer offered, and the status filter works.
    const stillOffered = ((await ctx.http().get(`${API}/orders/returnable`).set(auth(customer)).expect(200)).body as Envelope<ReturnableOrder[]>).data;
    expect(stillOffered.some((o) => o.orderId === order.id)).toBe(false);
    const refunded = ((await ctx.http().get(`${API}/returns?status=REFUNDED`).set(auth(customer)).expect(200)).body as Envelope<MyReturnView[]>).data;
    expect(refunded.some((r) => r.orderId === order.id)).toBe(false);
    // Another customer's returns are not visible.
    const other = await login(ctx, 'sadia@marketbd.example', 'Customer@12345').catch(() => null);
    if (other) {
      const theirs = await ctx.http().get(`${API}/returns`).set(auth(other)).expect(200);
      expect((theirs.body as Envelope<MyReturnView[]>).data.some((r) => r.orderId === order.id)).toBe(false);
    }
  });

  it('saves birthday and gender on the profile, with validation', async () => {
    const saved = await ctx.http().patch(`${API}/users/me`).set(auth(customer)).send({ birthday: '1995-04-21', gender: 'MALE' }).expect(200);
    expect((saved.body as Envelope<AuthUser>).data).toMatchObject({ birthday: '1995-04-21', gender: 'MALE' });

    const tooYoung = new Date();
    tooYoung.setUTCFullYear(tooYoung.getUTCFullYear() - 5);
    await ctx.http().patch(`${API}/users/me`).set(auth(customer)).send({ birthday: tooYoung.toISOString().slice(0, 10) }).expect(400);
    await ctx.http().patch(`${API}/users/me`).set(auth(customer)).send({ birthday: '1995-02-30' }).expect(400);
    await ctx.http().patch(`${API}/users/me`).set(auth(customer)).send({ gender: 'ROBOT' }).expect(400);

    const cleared = await ctx.http().patch(`${API}/users/me`).set(auth(customer)).send({ birthday: null, gender: null }).expect(200);
    expect((cleared.body as Envelope<AuthUser>).data).toMatchObject({ birthday: null, gender: null });
  });
});
