import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CheckoutPreview, CouponView, MyVoucherView, OrderDetail, OrderSummary } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
}

describe('Vouchers: collect, store / free-delivery / payment rules, seller vouchers (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let customer: string;
  let gadgetSeller: string;
  let deshiSeller: string;
  let addressId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const preview = async (body: Record<string, unknown>) =>
    ((await ctx.http().post(`${API}/checkout/preview`).set(auth(customer)).send({ addressId, ...body }).expect(201)).body as Envelope<CheckoutPreview>).data;
  /** Fills the cart with one Deshi Bazar product worth at least ৳500. */
  const deshiCart = async () => {
    await ctx.prisma.cartItem.deleteMany({ where: { cart: { user: { email: 'customer@marketbd.example' } } } });
    const product = await ctx.prisma.product.findFirstOrThrow({
      where: { status: 'ACTIVE', seller: { slug: 'deshi-bazar' }, variants: { some: { isActive: true, stock: { gte: 10 }, flashSaleItems: { none: {} } } } },
      include: { variants: { where: { isActive: true, stock: { gte: 10 }, flashSaleItems: { none: {} } } } },
      orderBy: { slug: 'asc' },
    });
    const variant = product.variants[0]!;
    const quantity = Math.min(10, Math.max(1, Math.ceil(50_000 / variant.price)));
    await ctx.http().post(`${API}/cart/items`).set(auth(customer)).send({ variantId: variant.id, quantity }).expect(201);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    customer = await login(ctx, 'customer@marketbd.example', 'Customer@12345');
    gadgetSeller = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    deshiSeller = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
    addressId = (await ctx.prisma.address.findFirstOrThrow({ where: { user: { email: 'customer@marketbd.example' }, isDefault: true } })).id;
  });

  afterAll(async () => {
    await setMultiVendor(ctx, admin, true);
    await ctx.prisma.cartItem.deleteMany({ where: { cart: { user: { email: 'customer@marketbd.example' } } } });
    await ctx.app.close();
  });

  it('lists all voucher kinds and lets a customer collect one into their wallet', async () => {
    const guest = ((await ctx.http().get(`${API}/coupons/available`).expect(200)).body as Envelope<CouponView[]>).data;
    expect(new Set(guest.map((c) => c.scope))).toEqual(new Set(['PLATFORM', 'STORE', 'PAYMENT']));
    expect(guest.every((c) => !c.collected)).toBe(true);
    expect(guest.find((c) => c.code === 'DESHI50')?.seller?.slug).toBe('deshi-bazar');

    const freeship = guest.find((c) => c.code === 'FREESHIP')!;
    await ctx.http().post(`${API}/coupons/${freeship.id}/collect`).expect(401);
    await ctx.http().post(`${API}/coupons/${freeship.id}/collect`).set(auth(customer)).expect(201);
    await ctx.http().post(`${API}/coupons/${freeship.id}/collect`).set(auth(customer)).expect(201); // idempotent

    const mine = ((await ctx.http().get(`${API}/coupons/available`).set(auth(customer)).expect(200)).body as Envelope<CouponView[]>).data;
    expect(mine.find((c) => c.code === 'FREESHIP')?.collected).toBe(true);
    const wallet = ((await ctx.http().get(`${API}/coupons/mine`).set(auth(customer)).expect(200)).body as Envelope<MyVoucherView[]>).data;
    expect(wallet.filter((c) => c.code === 'FREESHIP')).toHaveLength(1);
    expect(wallet[0]).toMatchObject({ code: 'FREESHIP', status: 'AVAILABLE' });
  });

  it('applies store vouchers only to that shop, and free delivery only to the delivery fee', async () => {
    await deshiCart();
    const other = await preview({ couponCode: 'GADGET5' });
    expect(other.couponError).toContain('Add items from Gadget Ghor');

    const store = await preview({ couponCode: 'DESHI50' });
    expect(store.coupon).toMatchObject({ code: 'DESHI50', discount: 5_000, appliesTo: 'items' });

    const ship = await preview({ couponCode: 'FREESHIP' });
    expect(ship.coupon).toMatchObject({ discount: ship.shippingFee, appliesTo: 'shipping' });
    expect(ship.total).toBe(ship.subtotal);

    // Free delivery does not cut the item value the seller pays commission on.
    const placed = await ctx.http().post(`${API}/orders`).set(auth(customer)).send({ addressId, paymentMethod: 'COD', couponCode: 'FREESHIP' }).expect(201);
    const order = (placed.body as Envelope<{ order: OrderSummary }>).data.order;
    const detail = ((await ctx.http().get(`${API}/orders/${order.id}`).set(auth(customer)).expect(200)).body as Envelope<OrderDetail>).data;
    const sub = detail.subOrders[0]!;
    expect(sub.discount).toBe(sub.shippingFee);
    expect(sub.commissionAmount).toBe(Math.round((sub.subtotal * sub.commissionRate) / 100));
    expect(detail.total).toBe(detail.subtotal);

    const wallet = ((await ctx.http().get(`${API}/coupons/mine`).set(auth(customer)).expect(200)).body as Envelope<MyVoucherView[]>).data;
    expect(wallet.find((c) => c.code === 'FREESHIP')?.status).toBe('AVAILABLE'); // per-user limit is 3
  });

  it('unlocks payment vouchers only with the matching payment method', async () => {
    await deshiCart();
    const cod = await preview({ couponCode: 'BKASH15' });
    expect(cod.couponError).toContain('Pay with bKash');
    const bkash = await preview({ couponCode: 'BKASH15', paymentMethod: 'BKASH' });
    expect(bkash.couponError).toBeNull();
    expect(bkash.coupon?.discount).toBeGreaterThan(0);
  });

  it('lets sellers run vouchers for their own shop only', async () => {
    const start = new Date(Date.now() - 60_000).toISOString();
    const end = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const created = await ctx
      .http()
      .post(`${API}/seller/coupons`)
      .set(auth(gadgetSeller))
      // scope/sellerId in the body are ignored: sellers always create STORE vouchers for themselves.
      .send({ code: 'GHORSHIP', type: 'FREE_SHIPPING', value: 0, startsAt: start, endsAt: end, scope: 'PLATFORM' })
      .expect(201);
    const voucher = (created.body as Envelope<CouponView>).data;
    expect(voucher).toMatchObject({ scope: 'STORE', seller: { slug: 'gadget-ghor' } });

    await ctx.http().patch(`${API}/seller/coupons/${voucher.id}`).set(auth(deshiSeller)).send({ code: 'GHORSHIP', type: 'FREE_SHIPPING', value: 0, startsAt: start, endsAt: end }).expect(403);
    await ctx.http().post(`${API}/seller/coupons`).set(auth(gadgetSeller)).send({ code: 'BADFIXED', type: 'FIXED', value: 0, startsAt: start, endsAt: end }).expect(400);
    await ctx.http().post(`${API}/seller/coupons`).set(auth(gadgetSeller)).send({ code: 'GHORSHIP', type: 'FIXED', value: 100, startsAt: start, endsAt: end }).expect(409);
    await ctx.http().post(`${API}/admin/coupons`).set(auth(admin)).send({ code: 'NOSHOP', type: 'FIXED', value: 100, scope: 'STORE', startsAt: start, endsAt: end }).expect(400);
    await ctx.http().delete(`${API}/seller/coupons/${voucher.id}`).set(auth(gadgetSeller)).expect(200);
  });

  it('hides marketplace store vouchers in single-vendor mode', async () => {
    await setMultiVendor(ctx, admin, false);
    const list = ((await ctx.http().get(`${API}/coupons/available`).expect(200)).body as Envelope<CouponView[]>).data;
    expect(list.some((c) => c.code === 'DESHI50')).toBe(false);
    expect(list.some((c) => c.code === 'OFFICIALSHIP')).toBe(true); // the house store is still visible
    await setMultiVendor(ctx, admin, true);
  });
});
