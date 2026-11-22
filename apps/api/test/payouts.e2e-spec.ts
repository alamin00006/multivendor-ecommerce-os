import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EarningRow, PayoutView, SellerEarnings, SellerReport } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const SELLER = 'freshbasket@marketbd.example';

describe('Seller earnings and payouts (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let seller: string;
  let sellerId: string;
  const orderIds: string[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const earnings = async () => ((await ctx.http().get(`${API}/seller/earnings`).set(auth(seller)).expect(200)).body as Envelope<SellerEarnings>).data;

  /** A delivered package for the seller, delivered `daysAgo` days ago. */
  const deliveredPackage = async (total: number, commission: number, daysAgo: number, channel: 'ONLINE' | 'POS' = 'ONLINE') => {
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'customer@marketbd.example' } });
    const at = new Date(Date.now() - daysAgo * 86_400_000);
    const order = await ctx.prisma.order.create({
      data: {
        orderNumber: `TEST-PAYOUT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        userId: customer.id,
        channel,
        status: 'DELIVERED',
        paymentMethod: channel === 'POS' ? 'CASH' : 'COD',
        paymentStatus: 'PAID',
        shippingZone: 'INSIDE_DHAKA',
        shippingAddress: {},
        subtotal: total,
        shippingFee: 0,
        total,
        subOrders: {
          create: { sellerId, status: 'DELIVERED', subtotal: total, shippingFee: 0, total, commissionRate: 10, commissionAmount: commission },
        },
      },
      include: { subOrders: true },
    });
    await ctx.prisma.orderStatusHistory.create({ data: { orderId: order.id, subOrderId: order.subOrders[0]!.id, toStatus: 'DELIVERED', createdAt: at } });
    orderIds.push(order.id);
    return order;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    seller = await login(ctx, SELLER, 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
    sellerId = (await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { user: { email: SELLER } } })).id;
    await ctx.prisma.payout.deleteMany({ where: { sellerId } });
    await ctx.prisma.sellerProfile.update({ where: { id: sellerId }, data: { payoutAccount: null as never } });
  });

  afterAll(async () => {
    await ctx.prisma.payout.deleteMany({ where: { sellerId } });
    await ctx.prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await ctx.app.close();
  });

  it('holds new earnings for the return window and releases older ones', async () => {
    const before = await earnings();
    await deliveredPackage(200_000, 20_000, 30); // cleared: +1,800
    await deliveredPackage(100_000, 10_000, 1); // on hold: +900
    await deliveredPackage(50_000, 5_000, 0, 'POS'); // counter sale: owes commission −50
    const e = await earnings();
    expect(e.gross - before.gross).toBe(350_000);
    expect(e.commission - before.commission).toBe(35_000);
    expect(e.onHold - before.onHold).toBe(90_000);
    expect(e.available - before.available).toBe(180_000 - 5_000);

    const ledger = ((await ctx.http().get(`${API}/seller/earnings/ledger`).set(auth(seller)).expect(200)).body as Envelope<EarningRow[]>).data;
    const held = ledger.find((r) => r.total === 100_000 && r.state === 'ON_HOLD');
    expect(held?.availableOn).toBeTruthy();
    expect(ledger.find((r) => r.channel === 'POS')).toMatchObject({ net: -5_000, state: 'AVAILABLE' });
  });

  it('needs a payout account, respects the balance and allows one waiting request', async () => {
    await ctx.http().post(`${API}/seller/payouts`).set(auth(seller)).send({ amount: 60_000 }).expect(400);
    await ctx.http().put(`${API}/seller/payout-account`).set(auth(seller)).send({ method: 'BANK', accountName: 'Fresh Basket', accountNumber: '1234 5678 90' }).expect(400);
    const saved = ((await ctx.http().put(`${API}/seller/payout-account`).set(auth(seller)).send({ method: 'BKASH', accountName: 'Fresh Basket', accountNumber: '01911-000003' }).expect(200)).body as Envelope<SellerEarnings>).data;
    expect(saved.payoutAccount).toMatchObject({ method: 'BKASH', accountNumber: '01911000003' });

    const { available } = await earnings();
    await ctx.http().post(`${API}/seller/payouts`).set(auth(seller)).send({ amount: 10_000 }).expect(400); // below ৳500
    expect((await ctx.http().post(`${API}/seller/payouts`).set(auth(seller)).send({ amount: available + 100 }).expect(400)).body.message).toContain('up to');

    const req = ((await ctx.http().post(`${API}/seller/payouts`).set(auth(seller)).send({ amount: 60_000, note: 'Weekly' }).expect(201)).body as Envelope<PayoutView>).data;
    expect(req).toMatchObject({ status: 'REQUESTED', amount: 60_000, method: 'BKASH' });
    await ctx.http().post(`${API}/seller/payouts`).set(auth(seller)).send({ amount: 50_000 }).expect(409);
    const after = await earnings();
    expect(after.available).toBe(available - 60_000);
    expect(after.requested).toBe(60_000);

    // Seller can cancel a waiting request, which frees the balance again
    await ctx.http().post(`${API}/seller/payouts/${req.id}/cancel`).set(auth(seller)).expect(201);
    expect((await earnings()).available).toBe(available);
  });

  it('admin pays or rejects requests and the seller is notified', async () => {
    const { available } = await earnings();
    const req = ((await ctx.http().post(`${API}/seller/payouts`).set(auth(seller)).send({ amount: 50_000 }).expect(201)).body as Envelope<PayoutView>).data;
    await ctx.http().get(`${API}/admin/payouts`).set(auth(seller)).expect(403);
    const list = ((await ctx.http().get(`${API}/admin/payouts`).query({ status: 'REQUESTED' }).set(auth(admin)).expect(200)).body as Envelope<PayoutView[]>).data;
    expect(list.find((p) => p.id === req.id)?.seller?.shopName).toBe('Fresh Basket');

    await ctx.http().patch(`${API}/admin/payouts/${req.id}`).set(auth(admin)).send({ status: 'PAID' }).expect(400); // needs reference
    const paid = ((await ctx.http().patch(`${API}/admin/payouts/${req.id}`).set(auth(admin)).send({ status: 'PAID', reference: 'TRX123' }).expect(200)).body as Envelope<PayoutView>).data;
    expect(paid).toMatchObject({ status: 'PAID', reference: 'TRX123' });
    await ctx.http().patch(`${API}/admin/payouts/${req.id}`).set(auth(admin)).send({ status: 'REJECTED', adminNote: 'x' }).expect(409);

    const e = await earnings();
    expect(e.paidOut).toBe(50_000);
    expect(e.available).toBe(available - 50_000);
    const note = await ctx.prisma.notification.findFirst({ where: { user: { email: SELLER }, title: 'Payout sent' }, orderBy: { createdAt: 'desc' } });
    expect(note?.body).toContain('TRX123');

    const second = ((await ctx.http().post(`${API}/seller/payouts`).set(auth(seller)).send({ amount: 50_000 }).expect(201)).body as Envelope<PayoutView>).data;
    await ctx.http().patch(`${API}/admin/payouts/${second.id}`).set(auth(admin)).send({ status: 'REJECTED' }).expect(400); // needs a reason
    await ctx.http().patch(`${API}/admin/payouts/${second.id}`).set(auth(admin)).send({ status: 'REJECTED', adminNote: 'Wrong number' }).expect(200);
    expect((await earnings()).available).toBe(available - 50_000);
  });

  it('reports sales for a date range with daily totals, top products and channels', async () => {
    const today = new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() + 6 * 3_600_000 - 6 * 86_400_000).toISOString().slice(0, 10);
    const report = ((await ctx.http().get(`${API}/seller/reports`).query({ from: weekAgo, to: today }).set(auth(seller)).expect(200)).body as Envelope<SellerReport>).data;
    expect(report.daily).toHaveLength(7);
    expect(report.daily.at(-1)?.date).toBe(today);
    expect(report.totals.orders).toBeGreaterThanOrEqual(3);
    expect(report.totals.gross).toBeGreaterThanOrEqual(350_000);
    expect(report.totals.net).toBe(report.totals.gross - report.totals.commission);
    expect(report.daily.reduce((s, d) => s + d.gross, 0)).toBe(report.totals.gross);
    expect(report.byChannel.find((c) => c.channel === 'POS')?.orders).toBeGreaterThanOrEqual(1);
    await ctx.http().get(`${API}/seller/reports`).query({ from: today, to: weekAgo }).set(auth(seller)).expect(400);
    await ctx.http().get(`${API}/seller/reports`).query({ from: '2024-01-01', to: today }).set(auth(seller)).expect(400);
  });

});
