import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChatMessageView, ChatThread, ConversationView } from '@marketbd/shared';
import { API, createTestApp, login, setMultiVendor, type TestContext } from './helpers.js';

interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: { total: number };
}

describe('Customer ↔ seller chat (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let customer: string;
  let gadgetSeller: string;
  let deshiSeller: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, 'admin@marketbd.example', 'Admin@12345');
    customer = await login(ctx, 'customer@marketbd.example', 'Customer@12345');
    gadgetSeller = await login(ctx, 'gadgetghor@marketbd.example', 'Seller@12345');
    deshiSeller = await login(ctx, 'deshibazar@marketbd.example', 'Seller@12345');
    await setMultiVendor(ctx, admin, true);
    await ctx.prisma.conversation.deleteMany({ where: { customer: { email: 'customer@marketbd.example' } } });
  });

  const sockets: Socket[] = [];
  let socketUrl = '';
  /** Connects to the chat namespace; resolves once connected or rejects when the server refuses. */
  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(socketUrl, { auth: { token }, transports: ['websocket'], reconnection: false });
      sockets.push(socket);
      socket.on('chat:unauthorized', () => reject(new Error('unauthorized')));
      // The server joins rooms after verifying the token; give it a moment before resolving.
      socket.on('connect', () => setTimeout(() => resolve(socket), 150));
      socket.on('connect_error', reject);
    });
  const next = <T>(socket: Socket, event: string, ms = 3000) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await setMultiVendor(ctx, admin, true);
    await ctx.app.close();
  });

  it('lets a customer message a shop about a product, and only that shop reply', async () => {
    const product = await ctx.prisma.product.findFirstOrThrow({ where: { status: 'ACTIVE', seller: { slug: 'gadget-ghor' } } });

    await ctx.http().post(`${API}/chat/conversations`).send({ productId: product.id }).expect(401);
    const started = await ctx.http().post(`${API}/chat/conversations`).set(auth(customer)).send({ productId: product.id }).expect(201);
    const conversation = (started.body as Envelope<ConversationView>).data;
    expect(conversation.shop.slug).toBe('gadget-ghor');
    expect(conversation.viewerSide).toBe('customer');

    // Starting again reuses the same thread.
    const again = await ctx.http().post(`${API}/chat/conversations`).set(auth(customer)).send({ sellerSlug: 'gadget-ghor' }).expect(201);
    expect((again.body as Envelope<ConversationView>).data.id).toBe(conversation.id);

    const sent = await ctx
      .http()
      .post(`${API}/chat/conversations/${conversation.id}/messages`)
      .set(auth(customer))
      .send({ body: '  Is this in stock?  ', productId: product.id })
      .expect(201);
    const message = (sent.body as Envelope<ChatMessageView>).data;
    expect(message.body).toBe('Is this in stock?');
    expect(message.side).toBe('customer');
    expect(message.product?.id).toBe(product.id);

    // Empty messages and products from another shop are rejected.
    await ctx.http().post(`${API}/chat/conversations/${conversation.id}/messages`).set(auth(customer)).send({ body: '   ' }).expect(400);
    const foreign = await ctx.prisma.product.findFirstOrThrow({ where: { seller: { slug: 'deshi-bazar' } } });
    await ctx
      .http()
      .post(`${API}/chat/conversations/${conversation.id}/messages`)
      .set(auth(customer))
      .send({ body: 'And this?', productId: foreign.id })
      .expect(400);

    // The shop sees one unread message and a notification; another seller cannot see the thread.
    const unread = await ctx.http().get(`${API}/seller/chat/unread`).set(auth(gadgetSeller)).expect(200);
    expect((unread.body as Envelope<{ count: number }>).data.count).toBe(1);
    const shopUserId = (await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'gadgetghor@marketbd.example' } })).id;
    const note = await ctx.prisma.notification.findFirst({ where: { userId: shopUserId, type: 'CHAT' }, orderBy: { createdAt: 'desc' } });
    expect(note?.data).toMatchObject({ conversationId: conversation.id });
    await ctx.http().get(`${API}/chat/conversations/${conversation.id}/messages`).set(auth(deshiSeller)).expect(404);
    await ctx.http().post(`${API}/chat/conversations/${conversation.id}/messages`).set(auth(deshiSeller)).send({ body: 'Hi' }).expect(404);

    // The seller reads and replies; the customer then sees the reply, an unread badge and "seen" state.
    const inbox = await ctx.http().get(`${API}/seller/chat/conversations`).set(auth(gadgetSeller)).expect(200);
    expect((inbox.body as Envelope<ConversationView[]>).data.map((c) => c.id)).toContain(conversation.id);
    await ctx.http().post(`${API}/chat/conversations/${conversation.id}/read`).set(auth(gadgetSeller)).expect(204);
    await ctx
      .http()
      .post(`${API}/chat/conversations/${conversation.id}/messages`)
      .set(auth(gadgetSeller))
      .send({ body: 'Yes, ready to ship today.' })
      .expect(201);

    const customerUnread = await ctx.http().get(`${API}/chat/unread`).set(auth(customer)).expect(200);
    expect((customerUnread.body as Envelope<{ count: number }>).data.count).toBe(1);
    const thread = await ctx.http().get(`${API}/chat/conversations/${conversation.id}/messages`).set(auth(customer)).expect(200);
    const view = (thread.body as Envelope<ChatThread>).data;
    expect(view.messages.map((m) => m.side)).toEqual(['customer', 'seller']);
    expect(view.conversation.otherLastReadAt).not.toBeNull();
    expect(new Date(view.conversation.otherLastReadAt!).getTime()).toBeGreaterThanOrEqual(new Date(view.messages[0]!.createdAt).getTime());
  });

  it('routes house-store chats to admins, and hides marketplace shops in single-vendor mode', async () => {
    const started = await ctx.http().post(`${API}/chat/conversations`).set(auth(customer)).send({}).expect(201);
    const storeThread = (started.body as Envelope<ConversationView>).data;
    expect(storeThread.shop.isHouseStore).toBe(true);
    await ctx.http().post(`${API}/chat/conversations/${storeThread.id}/messages`).set(auth(customer)).send({ body: 'Where is my order?' }).expect(201);

    const adminInbox = await ctx.http().get(`${API}/admin/chat/conversations`).set(auth(admin)).expect(200);
    expect((adminInbox.body as Envelope<ConversationView[]>).data.map((c) => c.id)).toContain(storeThread.id);
    await ctx.http().post(`${API}/chat/conversations/${storeThread.id}/messages`).set(auth(admin)).send({ body: 'It ships tomorrow.' }).expect(201);
    await ctx.http().get(`${API}/admin/chat/conversations`).set(auth(customer)).expect(403);

    await setMultiVendor(ctx, admin, false);
    const list = await ctx.http().get(`${API}/chat/conversations`).set(auth(customer)).expect(200);
    const visible = (list.body as Envelope<ConversationView[]>).data;
    expect(visible.every((c) => c.shop.isHouseStore)).toBe(true);
    // The store shows under the brand name, and marketplace sellers are locked out of chat.
    expect(visible[0]?.shop.name).toBe('MarketBD');
    await ctx.http().get(`${API}/seller/chat/conversations`).set(auth(gadgetSeller)).expect(403);
    await setMultiVendor(ctx, admin, true);
  });

  it('pushes messages, read receipts and typing over Socket.IO, and refuses bad tokens', async () => {
    await ctx.app.listen(0);
    socketUrl = `http://127.0.0.1:${((ctx.app.getHttpServer() as unknown as import('node:http').Server).address() as AddressInfo).port}/chat`;

    await expect(connect('not-a-token')).rejects.toThrow();

    const started = await ctx.http().post(`${API}/chat/conversations`).set(auth(customer)).send({ sellerSlug: 'gadget-ghor' }).expect(201);
    const conversationId = (started.body as Envelope<ConversationView>).data.id;
    const customerSocket = await connect(customer);
    const sellerSocket = await connect(gadgetSeller);
    const outsiderSocket = await connect(deshiSeller);

    // A REST send reaches the other side's socket right away; outsiders get nothing.
    const outsiderHeard = next(outsiderSocket, 'chat:message', 800).then(() => true, () => false);
    const sellerHeard = next<{ conversationId: string; message: ChatMessageView }>(sellerSocket, 'chat:message');
    await ctx.http().post(`${API}/chat/conversations/${conversationId}/messages`).set(auth(customer)).send({ body: 'Live hello' }).expect(201);
    const pushed = await sellerHeard;
    expect(pushed.conversationId).toBe(conversationId);
    expect(pushed.message).toMatchObject({ body: 'Live hello', side: 'customer' });
    expect(await outsiderHeard).toBe(false);

    // Typing is relayed to the other side only.
    const typing = next<{ conversationId: string; side: string }>(customerSocket, 'chat:typing');
    sellerSocket.emit('chat:typing', { conversationId });
    expect(await typing).toEqual({ conversationId, side: 'seller' });

    // Reading the thread tells the customer it was seen.
    const seen = next<{ conversationId: string; side: string; at: string }>(customerSocket, 'chat:read');
    await ctx.http().post(`${API}/chat/conversations/${conversationId}/read`).set(auth(gadgetSeller)).expect(204);
    expect(await seen).toMatchObject({ conversationId, side: 'seller' });
  });
});
