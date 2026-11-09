import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: { total: number };
}

describe('Marketplace modes and checkout (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let customer: string;
  let seller: string;
  let addressId: string;
  let houseVariant: string;
  let sellerVariant: string;
  let otherSellerVariant: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const variantFor = async (where: { isHouseStore: boolean; slug?: string }) => {
    const v = await ctx.prisma.productVariant.findFirstOrThrow({
      where: {
        isActive: true,
        stock: { gte: 5 },
        flashSaleItems: { none: {} },
        product: { status: 'ACTIVE', seller: { isHouseStore: where.isHouseStore, ...(where.slug ? { slug: where.slug } : {}) } },
      },
    });
    return v.id;
  };

  const clearCart = async () => {
    await ctx.prisma.cartItem.deleteMany({ where: { cart: { user: { email: 'customer@marketbd.example' } } } });
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    customer = await login(ctx, 'customer@marketbd.example', 'Customer@12345');
    seller = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    const address = await ctx.prisma.address.findFirstOrThrow({ where: { user: { email: 'customer@marketbd.example' } } });
    addressId = address.id;
    houseVariant = await variantFor({ isHouseStore: true });
    sellerVariant = await variantFor({ isHouseStore: false, slug: 'gadget-ghor' });
    otherSellerVariant = await variantFor({ isHouseStore: false, slug: 'deshi-bazar' });
  });

  afterAll(async () => {
    await setMultiVendor(ctx, admin, true);
    await ctx.app.close();
  });

  describe('multi-vendor ON', () => {
    beforeAll(async () => {
      await setMultiVendor(ctx, admin, true);
      await clearCart();
    });

    it('lists products from every approved seller with seller info', async () => {
      const res = await ctx.http().get(`${API}/products?limit=100`).expect(200);
      const body = res.body as Envelope<Array<{ seller: { isHouseStore: boolean } | null }>>;
      expect(body.meta?.total).toBe(84);
      expect(body.data.some((p) => p.seller && !p.seller.isHouseStore)).toBe(true);
    });

    it('allows seller endpoints', async () => {
      await ctx.http().get(`${API}/seller/products`).set(auth(seller)).expect(200);
      await ctx.http().get(`${API}/shops/gadget-ghor`).expect(200);
    });

    it('splits an order into one sub-order per seller with commission snapshots', async () => {
      for (const variantId of [houseVariant, sellerVariant, otherSellerVariant]) {
        await ctx.http().post(`${API}/cart/items`).set(auth(customer)).send({ variantId, quantity: 1 }).expect(201);
      }
      const stockBefore = await ctx.prisma.productVariant.findUniqueOrThrow({ where: { id: sellerVariant } });

      const placed = await ctx
        .http()
        .post(`${API}/orders`)
        .set(auth(customer))
        .send({ addressId, paymentMethod: 'COD' })
        .expect(201);
      const orderId = (placed.body as Envelope<{ order: { id: string } }>).data.order.id;

      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { subOrders: { include: { seller: true } } } });
      expect(order.subOrders).toHaveLength(3);
      const gadget = order.subOrders.find((s) => s.seller.slug === 'gadget-ghor');
      expect(gadget?.commissionRate.toNumber()).toBe(8);
      expect(order.total).toBe(order.subOrders.reduce((sum, s) => sum + s.total, 0));

      const stockAfter = await ctx.prisma.productVariant.findUniqueOrThrow({ where: { id: sellerVariant } });
      expect(stockAfter.stock).toBe(stockBefore.stock - 1);
      expect(await ctx.prisma.cartItem.count({ where: { cart: { userId: order.userId } } })).toBe(0);

      // Sellers only see their own sub-order; cancelling returns stock.
      const list = await ctx.http().get(`${API}/seller/orders`).set(auth(seller)).expect(200);
      const subs = (list.body as Envelope<Array<{ orderId: string; id: string }>>).data.filter((s) => s.orderId === orderId);
      expect(subs).toHaveLength(1);

      await ctx.http().post(`${API}/orders/${orderId}/cancel`).set(auth(customer)).send({ reason: 'Changed my mind' }).expect(201);
      const restocked = await ctx.prisma.productVariant.findUniqueOrThrow({ where: { id: sellerVariant } });
      expect(restocked.stock).toBe(stockBefore.stock);
    });

    it('rejects invalid status jumps by sellers', async () => {
      await ctx.http().post(`${API}/cart/items`).set(auth(customer)).send({ variantId: sellerVariant, quantity: 1 }).expect(201);
      await ctx.http().post(`${API}/orders`).set(auth(customer)).send({ addressId, paymentMethod: 'COD' }).expect(201);
      const list = await ctx.http().get(`${API}/seller/orders?status=PENDING`).set(auth(seller)).expect(200);
      const sub = (list.body as Envelope<Array<{ id: string }>>).data[0];
      expect(sub).toBeDefined();
      await ctx.http().patch(`${API}/seller/orders/${sub?.id}/status`).set(auth(seller)).send({ status: 'DELIVERED' }).expect(400);
      await ctx.http().patch(`${API}/seller/orders/${sub?.id}/status`).set(auth(seller)).send({ status: 'CONFIRMED' }).expect(200);
    });
  });

  describe('multi-vendor OFF (single-vendor store)', () => {
    beforeAll(async () => {
      await setMultiVendor(ctx, admin, false);
      await clearCart();
    });

    it('lists only house-store products and hides sellers', async () => {
      const res = await ctx.http().get(`${API}/products?limit=100`).expect(200);
      const body = res.body as Envelope<Array<{ seller: unknown }>>;
      const houseCount = await ctx.prisma.product.count({ where: { status: 'ACTIVE', seller: { isHouseStore: true } } });
      expect(body.meta?.total).toBe(houseCount);
      expect(body.data.every((p) => p.seller === null)).toBe(true);
    });

    it('blocks seller endpoints with 403 but keeps their products intact', async () => {
      await ctx.http().get(`${API}/seller/products`).set(auth(seller)).expect(403);
      await ctx.http().get(`${API}/shops/gadget-ghor`).expect(403);
      expect(await ctx.prisma.product.count({ where: { seller: { slug: 'gadget-ghor' } } })).toBeGreaterThan(0);
    });

    it('marks hidden seller items unavailable and blocks checkout for them', async () => {
      await ctx.prisma.cart.upsert({
        where: { userId: (await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'customer@marketbd.example' } })).id },
        update: { items: { create: { variantId: sellerVariant, quantity: 1 } } },
        create: {
          user: { connect: { email: 'customer@marketbd.example' } },
          items: { create: { variantId: sellerVariant, quantity: 1 } },
        },
      });
      const cart = await ctx.http().get(`${API}/cart`).set(auth(customer)).expect(200);
      const items = (cart.body as Envelope<{ items: Array<{ available: boolean }> }>).data.items;
      expect(items[0]?.available).toBe(false);
      await ctx.http().post(`${API}/orders`).set(auth(customer)).send({ addressId, paymentMethod: 'COD' }).expect(400);
      await ctx.http().post(`${API}/cart/items`).set(auth(customer)).send({ variantId: otherSellerVariant, quantity: 1 }).expect(404);
    });

    it('creates a single sub-order through the same pipeline', async () => {
      await clearCart();
      await ctx.http().post(`${API}/cart/items`).set(auth(customer)).send({ variantId: houseVariant, quantity: 2 }).expect(201);
      const placed = await ctx
        .http()
        .post(`${API}/orders`)
        .set(auth(customer))
        .send({ addressId, paymentMethod: 'COD', couponCode: 'WELCOME100' });
      // WELCOME100 needs a ৳1,000 minimum; retry without it if the house item is cheap.
      const res =
        placed.status === 201
          ? placed
          : await ctx.http().post(`${API}/orders`).set(auth(customer)).send({ addressId, paymentMethod: 'COD' }).expect(201);
      const orderId = (res.body as Envelope<{ order: { id: string } }>).data.order.id;
      const subs = await ctx.prisma.subOrder.findMany({ where: { orderId }, include: { seller: true } });
      expect(subs).toHaveLength(1);
      expect(subs[0]?.seller.isHouseStore).toBe(true);
    });
  });
});
