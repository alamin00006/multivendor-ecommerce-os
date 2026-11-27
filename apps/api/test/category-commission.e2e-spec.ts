import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CategoryNode, PosProduct, PosSaleResult } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
}

describe('Commission by category (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let seller: string;
  const touched: string[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const setRate = (id: string, commissionRate: number | null) =>
    ctx.http().patch(`${API}/admin/categories/${id}`).set(auth(admin)).send({ commissionRate }).expect(200);

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    seller = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
  });

  afterAll(async () => {
    await ctx.prisma.category.updateMany({ where: { id: { in: touched } }, data: { commissionRate: null } });
    await ctx.app.close();
  });

  const sellOne = async () => {
    const list = ((await ctx.http().get(`${API}/seller/pos/products`).set(auth(seller)).expect(200)).body as Envelope<PosProduct[]>).data;
    const product = list.find((p) => p.variants.some((x) => x.stock > 0))!;
    const v = product.variants.find((x) => x.stock > 0)!;
    const sale = ((await ctx.http().post(`${API}/seller/pos/sales`).set(auth(seller)).send({ items: [{ variantId: v.id, quantity: 1 }], cashReceived: v.price }).expect(201)).body as Envelope<PosSaleResult>).data;
    const sub = await ctx.prisma.subOrder.findFirstOrThrow({ where: { orderId: sale.order.id } });
    return { productId: product.id, price: v.price, rate: Number(sub.commissionRate), amount: sub.commissionAmount };
  };

  it('uses the category rate, then the parent’s, then the shop’s', async () => {
    const shop = await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { slug: 'deshi-bazar' } });
    const shopRate = Number(shop.commissionRate);

    // Find the category chain of the product the counter will sell
    const probe = await sellOne();
    const product = await ctx.prisma.product.findUniqueOrThrow({ where: { id: probe.productId }, include: { category: true } });
    const leaf = product.category;
    const parentId = leaf.parentId;
    touched.push(leaf.id, ...(parentId ? [parentId] : []));
    expect(probe.rate).toBe(shopRate);
    expect(probe.amount).toBe(Math.round((probe.price * shopRate) / 100));

    // Parent rate applies to sub-categories without their own
    if (parentId) {
      await setRate(parentId, 4);
      const viaParent = await sellOne();
      expect(viaParent.rate).toBe(4);
      expect(viaParent.amount).toBe(Math.round((viaParent.price * 4) / 100));
    }

    // The category's own rate wins
    const saved = ((await ctx.http().patch(`${API}/admin/categories/${leaf.id}`).set(auth(admin)).send({ commissionRate: 12.5 }).expect(200)).body as Envelope<CategoryNode>).data;
    expect(saved.commissionRate).toBe(12.5);
    const own = await sellOne();
    expect(own.rate).toBe(12.5);
    expect(own.amount).toBe(Math.round((own.price * 12.5) / 100));

    // Public category data does not show commission
    const pub = ((await ctx.http().get(`${API}/categories`).expect(200)).body as Envelope<CategoryNode[]>).data;
    expect(JSON.stringify(pub)).not.toContain('commissionRate');

    await ctx.http().patch(`${API}/admin/categories/${leaf.id}`).set(auth(admin)).send({ commissionRate: 120 }).expect(400);
    await setRate(leaf.id, null);
    if (parentId) await setRate(parentId, null);
    expect((await sellOne()).rate).toBe(shopRate);
  });
});
