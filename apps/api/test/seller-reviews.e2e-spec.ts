import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReviewView, SellerReviewStats, SellerReviewView } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
}

describe('Seller reviews and replies (e2e)', () => {
  let ctx: TestContext;
  let gadget: string;
  let deshi: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    const admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    gadget = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    deshi = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
  });

  afterAll(async () => {
    await ctx.prisma.review.updateMany({ where: { product: { seller: { slug: 'gadget-ghor' } } }, data: { sellerReply: null, sellerRepliedAt: null } });
    await ctx.app.close();
  });

  it('lists only the shop’s reviews, replies publicly and notifies the reviewer', async () => {
    const stats = ((await ctx.http().get(`${API}/seller/reviews/stats`).set(auth(gadget)).expect(200)).body as Envelope<SellerReviewStats>).data;
    expect(stats.count).toBeGreaterThan(0);
    expect(stats.unreplied).toBe(stats.count);

    const list = ((await ctx.http().get(`${API}/seller/reviews`).query({ replied: 'no' }).set(auth(gadget)).expect(200)).body as Envelope<SellerReviewView[]>).data;
    const gadgetId = (await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { slug: 'gadget-ghor' } })).id;
    const productIds = new Set((await ctx.prisma.product.findMany({ where: { sellerId: gadgetId }, select: { id: true } })).map((p) => p.id));
    expect(list.every((r) => productIds.has(r.product.id))).toBe(true);

    const target = list[0]!;
    await ctx.http().put(`${API}/seller/reviews/${target.id}/reply`).set(auth(deshi)).send({ reply: 'Not my product' }).expect(404);
    await ctx.http().put(`${API}/seller/reviews/${target.id}/reply`).set(auth(gadget)).send({ reply: 'x' }).expect(400);
    const replied = ((await ctx.http().put(`${API}/seller/reviews/${target.id}/reply`).set(auth(gadget)).send({ reply: 'Thank you for shopping with us!' }).expect(200)).body as Envelope<SellerReviewView>).data;
    expect(replied.sellerReply).toBe('Thank you for shopping with us!');
    expect(replied.sellerRepliedAt).toBeTruthy();

    // Public product reviews carry the reply
    const pub = ((await ctx.http().get(`${API}/products/${target.product.id}/reviews`).query({ limit: 50 }).expect(200)).body as Envelope<ReviewView[]>).data;
    expect(pub.find((r) => r.id === target.id)?.sellerReply).toBe('Thank you for shopping with us!');

    const note = await ctx.prisma.notification.findFirst({ where: { title: { contains: 'replied to your review' } }, orderBy: { createdAt: 'desc' } });
    expect(note?.body).toContain('Thank you');
    const after = ((await ctx.http().get(`${API}/seller/reviews/stats`).set(auth(gadget)).expect(200)).body as Envelope<SellerReviewStats>).data;
    expect(after.unreplied).toBe(stats.unreplied - (target.isVisible ? 1 : 0));

    await ctx.http().delete(`${API}/seller/reviews/${target.id}/reply`).set(auth(gadget)).expect(200);
    await ctx.http().delete(`${API}/seller/reviews/${target.id}/reply`).set(auth(gadget)).expect(400);
  });
});
