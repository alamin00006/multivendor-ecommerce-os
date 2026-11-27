import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DocumentQueueRow, SellerDocumentsView, ShopView } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
}

describe('Seller documents and verification (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let seller: string;
  let other: string;
  let sellerId: string;
  let photo: Buffer;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const upload = (token: string, type: string, file: Buffer, name: string, contentType: string) =>
    ctx.http().post(`${API}/sellers/me/documents`).query({ type }).set(auth(token)).attach('file', file, { filename: name, contentType });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    seller = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    other = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
    sellerId = (await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { slug: 'deshi-bazar' } })).id;
    photo = await sharp({ create: { width: 64, height: 40, channels: 3, background: '#2a6' } }).png().toBuffer();
  });

  afterAll(async () => {
    await ctx.prisma.sellerDocument.deleteMany({ where: { sellerId } });
    await ctx.prisma.sellerProfile.update({ where: { id: sellerId }, data: { verifiedAt: null } });
    await ctx.app.close();
  });

  it('keeps files private, lets an admin review them and shows the verified badge', async () => {
    const empty = ((await ctx.http().get(`${API}/sellers/me/documents`).set(auth(seller)).expect(200)).body as Envelope<SellerDocumentsView>).data;
    expect(empty.missing).toEqual(['NID_FRONT', 'NID_BACK']);

    // Bad files are refused
    await upload(seller, 'NID_FRONT', Buffer.from('hello'), 'x.txt', 'text/plain').expect(400);
    await upload(seller, 'TRADE_LICENSE', Buffer.from('not a pdf'), 'x.pdf', 'application/pdf').expect(400);

    await upload(seller, 'NID_FRONT', photo, 'front.png', 'image/png').expect(201);
    await upload(seller, 'NID_BACK', photo, 'back.png', 'image/png').expect(201);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const mine = ((await upload(seller, 'TRADE_LICENSE', pdf, 'license.pdf', 'application/pdf').expect(201)).body as Envelope<SellerDocumentsView>).data;
    expect(mine.documents.map((d) => d.type)).toEqual(['NID_FRONT', 'NID_BACK', 'TRADE_LICENSE']);
    expect(mine.missing).toEqual([]);
    const front = mine.documents[0]!;
    expect(front.mimeType).toBe('image/jpeg');

    // Only the shop and admins can open a file; there is no public URL
    const file = await ctx.http().get(`${API}/sellers/me/documents/${front.id}/file`).set(auth(seller)).expect(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
    await ctx.http().get(`${API}/sellers/me/documents/${front.id}/file`).set(auth(other)).expect(404);
    await ctx.http().get(`${API}/sellers/me/documents/${front.id}/file`).expect(401);
    await ctx.http().get(`${API}/admin/seller-documents/${sellerId}/${front.id}/file`).set(auth(admin)).expect(200);
    await ctx.http().get(`${API}/admin/seller-documents`).set(auth(seller)).expect(403);

    const queue = ((await ctx.http().get(`${API}/admin/seller-documents`).set(auth(admin)).expect(200)).body as Envelope<DocumentQueueRow[]>).data;
    expect(queue.find((q) => q.sellerId === sellerId)?.pending).toBe(3);

    // Verifying needs both NID sides approved
    await ctx.http().put(`${API}/admin/seller-documents/${sellerId}/verification`).set(auth(admin)).send({ verified: true }).expect(400);
    const back = mine.documents[1]!;
    await ctx.http().patch(`${API}/admin/seller-documents/${sellerId}/${back.id}`).set(auth(admin)).send({ status: 'REJECTED' }).expect(400);
    const rejected = ((await ctx.http().patch(`${API}/admin/seller-documents/${sellerId}/${back.id}`).set(auth(admin)).send({ status: 'REJECTED', note: 'Photo is blurry' }).expect(200)).body as Envelope<SellerDocumentsView>).data;
    expect(rejected.missing).toEqual(['NID_BACK']);
    const note = await ctx.prisma.notification.findFirst({ where: { title: 'Document needs another look' }, orderBy: { createdAt: 'desc' } });
    expect(note?.body).toContain('Photo is blurry');

    // Re-upload goes back to pending, then both sides are approved
    const again = ((await upload(seller, 'NID_BACK', photo, 'back2.png', 'image/png').expect(201)).body as Envelope<SellerDocumentsView>).data;
    expect(again.documents.find((d) => d.type === 'NID_BACK')?.status).toBe('PENDING');
    for (const d of again.documents.filter((x) => x.type !== 'TRADE_LICENSE')) {
      await ctx.http().patch(`${API}/admin/seller-documents/${sellerId}/${d.id}`).set(auth(admin)).send({ status: 'APPROVED' }).expect(200);
    }
    const verified = ((await ctx.http().put(`${API}/admin/seller-documents/${sellerId}/verification`).set(auth(admin)).send({ verified: true }).expect(200)).body as Envelope<SellerDocumentsView>).data;
    expect(verified.verifiedAt).toBeTruthy();

    const shop = ((await ctx.http().get(`${API}/shops/deshi-bazar`).expect(200)).body as Envelope<ShopView>).data;
    expect(shop.isVerified).toBe(true);

    // Approved papers of a verified shop are locked
    await upload(seller, 'NID_FRONT', photo, 'front.png', 'image/png').expect(400);
    await ctx.http().delete(`${API}/sellers/me/documents/${front.id}`).set(auth(seller)).expect(400);
  });
});
