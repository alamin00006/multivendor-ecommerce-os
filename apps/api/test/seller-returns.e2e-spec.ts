import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OrderDetail, SellerReturnView } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
}

describe('Seller returns (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let customer: string;
  let gadget: string;
  let deshi: string;
  const orderIds: string[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const list = async (token: string) => ((await ctx.http().get(`${API}/seller/orders/returns`).set(auth(token)).expect(200)).body as Envelope<SellerReturnView[]>).data;

  /** A delivered Gadget Ghor package (1 unit) the customer can return. */
  const deliveredOrder = async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'customer@marketbd.example' } });
    const seller = await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { slug: 'gadget-ghor' } });
    const variant = await ctx.prisma.productVariant.findFirstOrThrow({ where: { product: { sellerId: seller.id, status: 'ACTIVE' }, isActive: true }, orderBy: { sku: 'asc' }, include: { product: true } });
    const order = await ctx.prisma.order.create({
      data: {
        orderNumber: `TEST-RET-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        userId: user.id,
        status: 'DELIVERED',
        paymentMethod: 'COD',
        paymentStatus: 'PAID',
        shippingZone: 'INSIDE_DHAKA',
        shippingAddress: { fullName: 'Arif Rahman', phone: '+8801700000001', addressLine: 'Road 1', area: 'Gulshan', district: 'Dhaka', division: 'Dhaka' },
        subtotal: variant.price,
        shippingFee: 0,
        total: variant.price,
        subOrders: { create: { sellerId: seller.id, status: 'DELIVERED', subtotal: variant.price, shippingFee: 0, total: variant.price, commissionRate: 10, commissionAmount: Math.round(variant.price / 10) } },
      },
      include: { subOrders: true },
    });
    const sub = order.subOrders[0]!;
    await ctx.prisma.orderItem.create({
      data: { orderId: order.id, subOrderId: sub.id, productId: variant.productId, variantId: variant.id, title: variant.product.title, variantLabel: 'Default', sku: variant.sku, unitPrice: variant.price, quantity: 1, lineTotal: variant.price },
    });
    await ctx.prisma.orderStatusHistory.create({ data: { orderId: order.id, subOrderId: sub.id, toStatus: 'DELIVERED' } });
    orderIds.push(order.id);
    return { order, sub, variant };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    customer = await login(ctx, 'customer@marketbd.example', 'Customer@12345');
    gadget = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    deshi = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
  });

  afterAll(async () => {
    await ctx.prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await ctx.app.close();
  });

  it('lets the shop approve, then receive a return (restocking it); other shops cannot touch it', async () => {
    const { order, sub, variant } = await deliveredOrder();
    await ctx.http().post(`${API}/orders/${order.id}/returns`).set(auth(customer)).send({ reason: 'Wrong colour delivered', subOrderId: sub.id }).expect(201);

    const ret = (await list(gadget)).find((r) => r.orderId === order.id)!;
    expect(ret).toMatchObject({ status: 'REQUESTED', canAct: true, reason: 'Wrong colour delivered', amount: variant.price });
    expect(ret.customer.name).toBe('Arif Rahman');
    expect(ret.items[0]?.title).toBe(variant.product.title);
    expect((await list(deshi)).some((r) => r.id === ret.id)).toBe(false);
    await ctx.http().patch(`${API}/seller/orders/returns/${ret.id}`).set(auth(deshi)).send({ status: 'APPROVED' }).expect(404);

    // Cannot skip straight to received, and rejecting needs a reason
    await ctx.http().patch(`${API}/seller/orders/returns/${ret.id}`).set(auth(gadget)).send({ status: 'RECEIVED' }).expect(400);
    await ctx.http().patch(`${API}/seller/orders/returns/${ret.id}`).set(auth(gadget)).send({ status: 'REJECTED' }).expect(400);

    const approved = ((await ctx.http().patch(`${API}/seller/orders/returns/${ret.id}`).set(auth(gadget)).send({ status: 'APPROVED', sellerNote: 'Send it via courier' }).expect(200)).body as Envelope<SellerReturnView>).data;
    expect(approved).toMatchObject({ status: 'APPROVED', sellerNote: 'Send it via courier' });

    const stock = (await ctx.prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock;
    await ctx.http().patch(`${API}/seller/orders/returns/${ret.id}`).set(auth(gadget)).send({ status: 'RECEIVED' }).expect(200);
    expect((await ctx.prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(stock + 1);
    const detail = ((await ctx.http().get(`${API}/orders/${order.id}`).set(auth(customer)).expect(200)).body as Envelope<OrderDetail>).data;
    expect(detail.subOrders[0]?.status).toBe('RETURNED');
    const note = await ctx.prisma.notification.findFirst({ where: { user: { email: 'admin@marketbd.example' }, title: 'Return ready for refund' }, orderBy: { createdAt: 'desc' } });
    expect(note?.body).toContain(order.orderNumber);
  });

  it('rejecting puts the package back to delivered', async () => {
    const { order, sub } = await deliveredOrder();
    await ctx.http().post(`${API}/orders/${order.id}/returns`).set(auth(customer)).send({ reason: 'Changed my mind', subOrderId: sub.id }).expect(201);
    const ret = (await list(gadget)).find((r) => r.orderId === order.id)!;
    await ctx.http().patch(`${API}/seller/orders/returns/${ret.id}`).set(auth(gadget)).send({ status: 'REJECTED', sellerNote: 'Item was used' }).expect(200);
    expect((await ctx.prisma.subOrder.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe('DELIVERED');
  });
});
