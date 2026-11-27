import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminReport, SellerReport } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
}

describe('Admin marketplace report (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let gadget: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const day = (offset: number) => new Date(Date.now() + 6 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
  const range = { from: day(-365), to: day(0) };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    gadget = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('adds up every shop and matches the database', async () => {
    const r = ((await ctx.http().get(`${API}/admin/reports`).query(range).set(auth(admin)).expect(200)).body as Envelope<AdminReport>).data;

    const start = new Date(`${range.from}T00:00:00+06:00`);
    const end = new Date(`${range.to}T23:59:59.999+06:00`);
    const agg = await ctx.prisma.subOrder.aggregate({
      where: { createdAt: { gte: start, lte: end }, status: { notIn: ['CANCELLED', 'RETURNED', 'REFUNDED'] } },
      _sum: { total: true, commissionAmount: true, shippingFee: true },
      _count: true,
    });
    expect(r.totals.gross).toBe(agg._sum.total ?? 0);
    expect(r.totals.commission).toBe(agg._sum.commissionAmount ?? 0);
    expect(r.totals.shipping).toBe(agg._sum.shippingFee ?? 0);
    expect(r.totals.orders).toBe(agg._count);

    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(r.bySeller.map((s) => s.gross))).toBe(r.totals.gross);
    expect(sum(r.byPayment.map((p) => p.gross))).toBe(r.totals.gross);
    expect(sum(r.daily.map((d) => d.net))).toBe(r.totals.commission);
    expect(r.daily).toHaveLength(366);

    // One shop's line equals that shop's own report
    const own = ((await ctx.http().get(`${API}/seller/reports`).query(range).set(auth(gadget)).expect(200)).body as Envelope<SellerReport>).data;
    const gadgetId = (await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { slug: 'gadget-ghor' } })).id;
    expect(r.bySeller.find((s) => s.sellerId === gadgetId)?.gross ?? 0).toBe(own.totals.gross);

    await ctx.http().get(`${API}/admin/reports`).query(range).set(auth(gadget)).expect(403);
    await ctx.http().get(`${API}/admin/reports`).query({ from: day(0), to: day(-3) }).set(auth(admin)).expect(400);
  });
});
