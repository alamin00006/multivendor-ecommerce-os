import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BulkStockResult, OrderDetail, OrderSummary, PosProduct, PosSaleResult, SellerEarnings } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

describe('Admin POS: counter sales paid in cash (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let customer: string;
  let product: PosProduct;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const sell = (body: Record<string, unknown>) => ctx.http().post(`${API}/admin/pos/sales`).set(auth(admin)).send(body);

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    customer = await login(ctx, 'customer@marketbd.example', 'Customer@12345');
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('is for admins only and lists house-store products by title or SKU', async () => {
    await ctx.http().get(`${API}/admin/pos/products`).set(auth(customer)).expect(403);
    const list = ((await ctx.http().get(`${API}/admin/pos/products`).set(auth(admin)).expect(200)).body as Envelope<PosProduct[]>).data;
    expect(list.length).toBeGreaterThan(0);
    const house = await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { isHouseStore: true } });
    const ids = new Set((await ctx.prisma.product.findMany({ where: { sellerId: house.id }, select: { id: true } })).map((p) => p.id));
    expect(list.every((p) => ids.has(p.id))).toBe(true);

    product = list.find((p) => p.variants.some((v) => v.stock >= 5))!;
    expect(product).toBeTruthy();
    const sku = product.variants[0]!.sku;
    const bySku = ((await ctx.http().get(`${API}/admin/pos/products`).query({ q: sku.toLowerCase() }).set(auth(admin)).expect(200)).body as Envelope<PosProduct[]>).data;
    expect(bySku[0]?.id).toBe(product.id);
  });

  it('records a walk-in cash sale as delivered and paid, takes stock and returns the change', async () => {
    const variant = product.variants.find((v) => v.stock >= 5)!;
    const before = await ctx.prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    const total = variant.price * 2 - 1000;

    // Not enough cash, discount over subtotal and empty carts are refused
    expect((await sell({ items: [{ variantId: variant.id, quantity: 2 }], discount: 1000, cashReceived: total - 1 }).expect(400)).body.message).toContain('less than the total');
    await sell({ items: [{ variantId: variant.id, quantity: 1 }], discount: variant.price + 1, cashReceived: 10_000_000 }).expect(400);
    await sell({ items: [], cashReceived: 0 }).expect(400);
    await sell({ items: [{ variantId: variant.id, quantity: before.stock + 1 }], cashReceived: 100_000_000 }).expect(409);

    const res = (await sell({ items: [{ variantId: variant.id, quantity: 2 }], discount: 1000, cashReceived: total + 5000 }).expect(201)).body as Envelope<PosSaleResult>;
    expect(res.message).toBe('Sale completed');
    const sale = res.data;
    expect(sale.change).toBe(5000);
    expect(sale.customer).toBeNull();
    expect(sale.order).toMatchObject({ channel: 'POS', status: 'DELIVERED', paymentMethod: 'CASH', paymentStatus: 'PAID', total, discount: 1000, shippingFee: 0, canReturn: false, canPay: false, canCancel: false });
    expect(sale.order.shippingAddress.fullName).toBe('Walk-in customer');
    expect(sale.order.payments[0]).toMatchObject({ method: 'CASH', status: 'PAID', amount: total });

    const after = await ctx.prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.stock).toBe(before.stock - 2);

    const walkIn = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'walk-in@pos.marketbd.local' } });
    expect(walkIn.isActive).toBe(false);
    expect(walkIn.passwordHash).toBeNull();

    // Receipt can be reprinted, and admin can filter orders by channel
    const receipt = ((await ctx.http().get(`${API}/admin/pos/sales/${sale.order.id}`).set(auth(admin)).expect(200)).body as Envelope<PosSaleResult>).data;
    expect(receipt).toMatchObject({ cashReceived: total + 5000, change: 5000, customer: null });
    const pos = ((await ctx.http().get(`${API}/admin/orders`).query({ channel: 'POS' }).set(auth(admin)).expect(200)).body as Envelope<OrderSummary[]>).data;
    expect(pos.map((o) => o.id)).toContain(sale.order.id);
    expect(pos.every((o) => o.channel === 'POS')).toBe(true);
    const online = ((await ctx.http().get(`${API}/admin/orders`).query({ channel: 'ONLINE' }).set(auth(admin)).expect(200)).body as Envelope<OrderSummary[]>).data;
    expect(online.some((o) => o.id === sale.order.id)).toBe(false);
  });

  it('links the sale to a registered customer by phone so it shows in their orders', async () => {
    const variant = product.variants[0]!;
    const sale = ((await sell({ items: [{ variantId: variant.id, quantity: 1 }], cashReceived: variant.price, customerPhone: '01700000001' }).expect(201)).body as Envelope<PosSaleResult>).data;
    expect(sale.customer?.name).toBe('Arif Rahman');
    expect(sale.change).toBe(0);
    const mine = ((await ctx.http().get(`${API}/orders/${sale.order.id}`).set(auth(customer)).expect(200)).body as Envelope<OrderDetail>).data;
    expect(mine).toMatchObject({ channel: 'POS', paymentMethod: 'CASH', canReturn: false });
  });

  it('keeps cash out of online checkout', async () => {
    const addressId = (await ctx.prisma.address.findFirstOrThrow({ where: { user: { email: 'customer@marketbd.example' }, isDefault: true } })).id;
    await ctx.http().post(`${API}/orders`).set(auth(customer)).send({ addressId, paymentMethod: 'CASH' }).expect(400);
  });

  it('lets a seller run a counter for their own shop; the commission comes out of their balance', async () => {
    await setMultiVendor(ctx, admin, true);
    const seller = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    const list = ((await ctx.http().get(`${API}/seller/pos/products`).set(auth(seller)).expect(200)).body as Envelope<PosProduct[]>).data;
    const deshi = await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { slug: 'deshi-bazar' } });
    const own = new Set((await ctx.prisma.product.findMany({ where: { sellerId: deshi.id }, select: { id: true } })).map((p) => p.id));
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => own.has(p.id))).toBe(true);

    // House-store items cannot be sold from a seller counter
    await ctx.http().post(`${API}/seller/pos/sales`).set(auth(seller)).send({ items: [{ variantId: product.variants[0]!.id, quantity: 1 }], cashReceived: 100_000_000 }).expect(400);

    const before = ((await ctx.http().get(`${API}/seller/earnings`).set(auth(seller)).expect(200)).body as Envelope<SellerEarnings>).data;
    const v = list.find((p) => p.variants.some((x) => x.stock > 0))!.variants.find((x) => x.stock > 0)!;
    const sale = ((await ctx.http().post(`${API}/seller/pos/sales`).set(auth(seller)).send({ items: [{ variantId: v.id, quantity: 1 }], cashReceived: v.price }).expect(201)).body as Envelope<PosSaleResult>).data;
    expect(sale.shop.name).toBe('Deshi Bazar');
    expect(sale.order.channel).toBe('POS');
    const after = ((await ctx.http().get(`${API}/seller/earnings`).set(auth(seller)).expect(200)).body as Envelope<SellerEarnings>).data;
    const commission = (await ctx.prisma.subOrder.findFirstOrThrow({ where: { orderId: sale.order.id } })).commissionAmount;
    expect(after.net - before.net).toBe(-commission);

    // Receipts are private to the shop that made the sale
    await ctx.http().get(`${API}/seller/pos/sales/${sale.order.id}`).set(auth(seller)).expect(200);
    await ctx.http().get(`${API}/admin/pos/sales/${sale.order.id}`).set(auth(admin)).expect(404);
    const gadget = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    await ctx.http().get(`${API}/seller/pos/sales/${sale.order.id}`).set(auth(gadget)).expect(404);
  });

  it('bulk-updates price and stock by SKU and reports bad rows', async () => {
    const seller = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    const sheet = ((await ctx.http().get(`${API}/seller/products/stock-sheet`).set(auth(seller)).expect(200)).body as Envelope<Array<{ sku: string; price: number; stock: number }>>).data;
    expect(sheet.length).toBeGreaterThan(1);
    const [a, b] = sheet as [(typeof sheet)[number], (typeof sheet)[number]];
    const res = ((await ctx.http().post(`${API}/seller/products/bulk-stock`).set(auth(seller)).send({
      rows: [
        { sku: a.sku.toLowerCase(), stock: 77 },
        { sku: b.sku, price: b.price + 100, stock: b.stock },
        { sku: 'NOPE-123', stock: 1 },
        { sku: a.sku, stock: 5 },
        { sku: product.variants[0]!.sku, stock: 1 },
      ],
    }).expect(201)).body as Envelope<BulkStockResult>).data;
    expect(res.updated).toBe(2);
    expect(res.errors.map((e) => e.row)).toEqual([3, 4, 5]);
    expect((await ctx.prisma.productVariant.findUniqueOrThrow({ where: { sku: a.sku } })).stock).toBe(77);
    const vb = await ctx.prisma.productVariant.findUniqueOrThrow({ where: { sku: b.sku }, include: { product: { include: { variants: true } } } });
    expect(vb.price).toBe(b.price + 100);
    expect(vb.product.minPrice).toBe(Math.min(...vb.product.variants.filter((x) => x.isActive).map((x) => x.price)));
    await ctx.prisma.productVariant.update({ where: { sku: a.sku }, data: { stock: a.stock } });
  });

});
