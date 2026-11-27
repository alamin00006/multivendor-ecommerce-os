import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ActivityView, AuthUser, StaffView } from '@marketbd/shared';
import { API, createTestApp, login, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
}

describe('Admin staff permissions and activity log (e2e)', () => {
  let ctx: TestContext;
  let owner: string;
  const email = `staff-${Date.now()}@marketbd.example`;
  const password = 'Staff@12345';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
  });

  afterAll(async () => {
    await ctx.prisma.adminActivity.deleteMany({ where: { actor: { email } } });
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  it('limits a staff member to their areas, logs changes and protects the owner', async () => {
    const created = ((await ctx.http().post(`${API}/admin/staff`).set(auth(owner)).send({ name: 'Order Desk', email, password, permissions: ['orders', 'catalog'] }).expect(201)).body as Envelope<StaffView>).data;
    expect(created.permissions).toEqual(['orders', 'catalog']);
    await ctx.http().post(`${API}/admin/staff`).set(auth(owner)).send({ name: 'Again', email, password, permissions: [] }).expect(409);

    const staff = await login(ctx, email, password);
    const me = ((await ctx.http().get(`${API}/users/me`).set(auth(staff)).expect(200)).body as Envelope<AuthUser>).data;
    expect(me.adminPermissions).toEqual(['orders', 'catalog']);

    // Allowed: own areas, the dashboard and reading store settings
    await ctx.http().get(`${API}/admin/dashboard`).set(auth(staff)).expect(200);
    await ctx.http().get(`${API}/admin/orders`).set(auth(staff)).expect(200);
    await ctx.http().get(`${API}/admin/categories`).set(auth(staff)).expect(200);
    await ctx.http().get(`${API}/admin/settings`).set(auth(staff)).expect(200);
    // Blocked: other areas and owner-only pages
    await ctx.http().get(`${API}/admin/payouts`).set(auth(staff)).expect(403);
    await ctx.http().get(`${API}/admin/banners`).set(auth(staff)).expect(403);
    await ctx.http().patch(`${API}/admin/settings`).set(auth(staff)).send({}).expect(403);
    await ctx.http().get(`${API}/admin/staff`).set(auth(staff)).expect(403);
    await ctx.http().get(`${API}/admin/activity`).set(auth(staff)).expect(403);
    const anySeller = await ctx.prisma.sellerProfile.findFirstOrThrow({ where: { isHouseStore: false } });
    await ctx.http().get(`${API}/admin/sellers/${anySeller.id}/adjustments`).set(auth(staff)).expect(403);

    // A change is logged with its summary, secrets hidden
    const cat = await ctx.prisma.category.findFirstOrThrow({ where: { parentId: null } });
    await ctx.http().patch(`${API}/admin/categories/${cat.id}`).set(auth(staff)).send({ sortOrder: cat.sortOrder }).expect(200);
    const log = ((await ctx.http().get(`${API}/admin/activity`).query({ actorId: created.id }).set(auth(owner)).expect(200)).body as Envelope<ActivityView[]>).data;
    expect(log[0]).toMatchObject({ method: 'PATCH', path: `/admin/categories/${cat.id}`, area: 'catalog', summary: 'Category updated', actor: { name: 'Order Desk' } });
    const ownerLog = ((await ctx.http().get(`${API}/admin/activity`).query({ q: 'Staff account created' }).set(auth(owner)).expect(200)).body as Envelope<ActivityView[]>).data;
    expect(JSON.stringify(ownerLog[0]?.details)).toContain('[hidden]');
    expect(JSON.stringify(ownerLog[0]?.details)).not.toContain(password);

    // Staff with the customers area cannot promote or demote admins
    await ctx.http().patch(`${API}/admin/staff/${created.id}`).set(auth(owner)).send({ permissions: ['customers'] }).expect(200);
    const customer = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'CUSTOMER' } });
    await ctx.http().patch(`${API}/admin/users/${customer.id}`).set(auth(staff)).send({ role: 'ADMIN' }).expect(403);
    const ownerId = (await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'admin@marketbd.example' } })).id;
    await ctx.http().patch(`${API}/admin/users/${ownerId}`).set(auth(staff)).send({ isActive: false }).expect(403);

    // The last owner cannot lose full access
    await ctx.http().patch(`${API}/admin/staff/${ownerId}`).set(auth(owner)).send({ permissions: ['orders'] }).expect(400);

    // Disabling takes effect on the next request
    await ctx.http().patch(`${API}/admin/staff/${created.id}`).set(auth(owner)).send({ isActive: false }).expect(200);
    await ctx.http().get(`${API}/admin/dashboard`).set(auth(staff)).expect(401);
  });
});
