import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PushService } from '../src/modules/notifications/push.service.js';
import { API, createTestApp, login, type TestContext } from './helpers.js';

const GOOD = 'ExponentPushToken[good-device-1]';
const GONE = 'ExponentPushToken[old-device-2]';

describe('Push notifications (e2e)', () => {
  let ctx: TestContext;
  let customer: string;
  let server: Server;
  const received: Array<Array<{ to: string; title: string; body: string; data: Record<string, string> }>> = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    customer = await login(ctx, 'customer@marketbd.example', 'Customer@12345');
    // Fake Expo push service: accepts the good token, reports the old one as unregistered.
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c: Buffer) => (raw += c.toString()));
      req.on('end', () => {
        const messages = JSON.parse(raw) as Array<{ to: string; title: string; body: string; data: Record<string, string> }>;
        received.push(messages);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ data: messages.map((m) => (m.to === GONE ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'x' })) }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const push = ctx.app.get(PushService);
    push.enabled = true;
    push.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/send`;
  });

  afterAll(async () => {
    await ctx.prisma.pushToken.deleteMany({});
    server.close();
    await ctx.app.close();
  });

  it('registers devices, pushes notifications and drops dead tokens', async () => {
    await ctx.http().post(`${API}/notifications/push-token`).send({ token: GOOD, platform: 'android' }).expect(401);
    await ctx.http().post(`${API}/notifications/push-token`).set(auth(customer)).send({ token: 'not-a-token', platform: 'android' }).expect(400);
    await ctx.http().post(`${API}/notifications/push-token`).set(auth(customer)).send({ token: GOOD, platform: 'android' }).expect(200);
    await ctx.http().post(`${API}/notifications/push-token`).set(auth(customer)).send({ token: GONE, platform: 'ios' }).expect(200);
    await ctx.http().post(`${API}/notifications/push-token`).set(auth(customer)).send({ token: GOOD, platform: 'android' }).expect(200); // idempotent
    expect(await ctx.prisma.pushToken.count({ where: { user: { email: 'customer@marketbd.example' } } })).toBe(2);

    // Any in-app notification also goes to the phone
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'customer@marketbd.example' } });
    const { NotificationsService } = await import('../src/modules/notifications/notifications.service.js');
    await ctx.app.get(NotificationsService).notify(user.id, 'ORDER', 'Order shipped', 'Your order is on the way', { orderId: 'o1' });
    for (let i = 0; i < 40 && received.length === 0; i++) await new Promise((r) => setTimeout(r, 50));
    expect(received[0]?.map((m) => m.to).sort()).toEqual([GOOD, GONE].sort());
    expect(received[0]?.[0]).toMatchObject({ title: 'Order shipped', body: 'Your order is on the way', data: { orderId: 'o1' } });

    // The token Expo reported as gone is removed
    for (let i = 0; i < 40 && (await ctx.prisma.pushToken.count({ where: { token: GONE } })) > 0; i++) await new Promise((r) => setTimeout(r, 50));
    expect(await ctx.prisma.pushToken.count({ where: { token: GONE } })).toBe(0);

    // Sign-out removes the device
    await ctx.http().delete(`${API}/notifications/push-token`).set(auth(customer)).send({ token: GOOD }).expect(200);
    expect(await ctx.prisma.pushToken.count({ where: { token: GOOD } })).toBe(0);
  });
});
