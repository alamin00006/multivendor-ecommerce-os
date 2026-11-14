import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: { total: number };
}

describe('Settings, product content, Q&A and bought-together (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let customer: string;
  let gadgetSeller: string;
  let deshiSeller: string;
  let addressId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const sellerProduct = (slug: string) =>
    ctx.prisma.product.findFirstOrThrow({
      where: { status: 'ACTIVE', seller: { slug } },
      include: { variants: { where: { isActive: true, stock: { gte: 5 }, flashSaleItems: { none: {} } } } },
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    customer = await login(ctx, 'customer@marketbd.example', 'Customer@12345');
    gadgetSeller = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    deshiSeller = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
    addressId = (await ctx.prisma.address.findFirstOrThrow({ where: { user: { email: 'customer@marketbd.example' } } })).id;
    await ctx.prisma.cartItem.deleteMany({ where: { cart: { user: { email: 'customer@marketbd.example' } } } });
  });

  afterAll(async () => {
    await ctx.http().patch(`${API}/admin/settings`).set(auth(admin)).send({ shippingInsideDhaka: 6000, shippingOutsideDhaka: 12000 });
    await ctx.app.close();
  });

  it('serves admin-managed delivery, returns and store info, and checkout uses the delivery fee', async () => {
    await ctx
      .http()
      .patch(`${API}/admin/settings`)
      .set(auth(admin))
      .send({ shippingInsideDhaka: 4500, shippingOutsideDhaka: 9900, supportPhone: '+8801700000999', returnDays: 10 })
      .expect(200);

    const pub = await ctx.http().get(`${API}/settings/public`).expect(200);
    const settings = (pub.body as Envelope<{ shipping: { insideDhaka: number }; store: { phone: string }; returns: { days: number } }>).data;
    expect(settings.shipping.insideDhaka).toBe(4500);
    expect(settings.store.phone).toBe('+8801700000999');
    expect(settings.returns.days).toBe(10);

    // The seeded customer's address is in Dhanmondi (inside Dhaka).
    const product = await sellerProduct('gadget-ghor');
    await ctx.http().post(`${API}/cart/items`).set(auth(customer)).send({ variantId: product.variants[0]!.id, quantity: 1 }).expect(201);
    const preview = await ctx.http().post(`${API}/checkout/preview`).set(auth(customer)).send({ addressId }).expect(201);
    expect((preview.body as Envelope<{ shippingFee: number }>).data.shippingFee).toBe(4500);

    await ctx.http().patch(`${API}/admin/settings`).set(auth(customer)).send({ returnDays: 1 }).expect(403);
    await ctx.http().patch(`${API}/admin/settings`).set(auth(admin)).send({ supportEmail: 'not-an-email' }).expect(400);
  });

  it('records products bought in the same order as "frequently bought together"', async () => {
    const other = await sellerProduct('deshi-bazar');
    await ctx.http().post(`${API}/cart/items`).set(auth(customer)).send({ variantId: other.variants[0]!.id, quantity: 1 }).expect(201);
    await ctx.http().post(`${API}/orders`).set(auth(customer)).send({ addressId, paymentMethod: 'COD' }).expect(201);

    const gadget = await sellerProduct('gadget-ghor');
    const res = await ctx.http().get(`${API}/products/${gadget.slug}/bought-together`).expect(200);
    expect((res.body as Envelope<Array<{ id: string }>>).data.map((p) => p.id)).toContain(other.id);
  });

  it('lets customers ask, only the owning seller answer, and admins hide questions', async () => {
    const product = await sellerProduct('gadget-ghor');
    await ctx.http().post(`${API}/products/${product.id}/questions`).send({ question: 'Does it come with a charger?' }).expect(401);
    const asked = await ctx
      .http()
      .post(`${API}/products/${product.id}/questions`)
      .set(auth(customer))
      .send({ question: 'Does it come with a charger?' })
      .expect(201);
    const questionId = (asked.body as Envelope<{ id: string }>).data.id;

    // Another shop cannot answer; the owning shop can.
    await ctx.http().patch(`${API}/seller/questions/${questionId}/answer`).set(auth(deshiSeller)).send({ answer: 'Yes' }).expect(403);
    await ctx
      .http()
      .patch(`${API}/seller/questions/${questionId}/answer`)
      .set(auth(gadgetSeller))
      .send({ answer: 'Yes, a 45W charger is included.' })
      .expect(200);

    const list = await ctx.http().get(`${API}/products/${product.id}/questions`).expect(200);
    const answered = (list.body as Envelope<Array<{ id: string; answer: string; answeredBy: { name: string; role: string } }>>).data.find(
      (q) => q.id === questionId,
    );
    expect(answered?.answer).toBe('Yes, a 45W charger is included.');
    expect(answered?.answeredBy).toEqual({ name: 'Gadget Ghor', role: 'seller' });

    // The asker is notified.
    const notified = await ctx.prisma.notification.count({
      where: { user: { email: 'customer@marketbd.example' }, title: 'Your question was answered' },
    });
    expect(notified).toBeGreaterThan(0);

    await ctx.http().patch(`${API}/admin/questions/${questionId}`).set(auth(admin)).send({ isVisible: false }).expect(200);
    const after = await ctx.http().get(`${API}/products/${product.id}/questions`).expect(200);
    expect((after.body as Envelope<Array<{ id: string }>>).data.some((q) => q.id === questionId)).toBe(false);
  });

  it('saves category SEO content and product key features/specifications', async () => {
    const category = await ctx.prisma.category.findFirstOrThrow({ where: { parentId: null } });
    await ctx
      .http()
      .patch(`${API}/admin/categories/${category.id}`)
      .set(auth(admin))
      .send({ seoContent: '## Buying guide\n\nPick the right size.' })
      .expect(200);
    const cat = await ctx.http().get(`${API}/categories/${category.slug}`).expect(200);
    expect((cat.body as Envelope<{ seoContent: string }>).data.seoContent).toContain('Buying guide');

    const product = await sellerProduct('gadget-ghor');
    await ctx
      .http()
      .patch(`${API}/seller/products/${product.id}`)
      .set(auth(gadgetSeller))
      .send({
        highlights: ['Fast charging', 'Two-year battery life'],
        specifications: [{ label: 'Battery', value: '5000 mAh' }],
        warranty: '1 year brand warranty',
      })
      .expect(200);
    const detail = await ctx.http().get(`${API}/products/${product.slug}`).expect(200);
    const body = (detail.body as Envelope<{ highlights: string[]; specifications: Array<{ label: string }>; warranty: string }>).data;
    expect(body.highlights).toEqual(['Fast charging', 'Two-year battery life']);
    expect(body.specifications[0]?.label).toBe('Battery');
    expect(body.warranty).toBe('1 year brand warranty');
  });
});
