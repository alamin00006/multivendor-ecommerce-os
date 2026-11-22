import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BRAND,
  type ChatMessageView,
  type ChatSide,
  type ChatThread,
  type ConversationListQuerySchema,
  type ConversationView,
  type SendMessageSchema,
  type StartConversationSchema,
} from '@marketbd/shared';
import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthUserContext } from '../../common/auth-user.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';
import { ChatRealtime } from './chat.realtime.js';

type ListQuery = z.infer<typeof ConversationListQuerySchema>;
type StartInput = z.infer<typeof StartConversationSchema>;
type SendInput = z.infer<typeof SendMessageSchema>;

const conversationInclude = {
  seller: { select: { id: true, userId: true, shopName: true, slug: true, logoUrl: true, isHouseStore: true, status: true } },
  customer: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.ConversationInclude;

const messageInclude = {
  product: {
    select: {
      id: true,
      slug: true,
      title: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
      variants: { where: { isActive: true }, orderBy: { price: 'asc' }, take: 1, select: { price: true } },
    },
  },
} satisfies Prisma.ChatMessageInclude;

type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;
type MessageRow = Prisma.ChatMessageGetPayload<{ include: typeof messageInclude }>;

const toSide = (s: 'CUSTOMER' | 'SELLER'): ChatSide => (s === 'CUSTOMER' ? 'customer' : 'seller');
const PREVIEW_LENGTH = 120;

/**
 * Customer ↔ shop messaging. Customers start threads; the shop side is answered by the seller,
 * or by admins for the house store (which is also the only shop in single-vendor mode).
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: PlatformModeService,
    private readonly access: SellerAccessService,
    private readonly notifications: NotificationsService,
    private readonly realtime: ChatRealtime,
  ) {}

  // ───────── Views ─────────

  private toConversation(c: ConversationRow, viewerSide: ChatSide, multiVendor: boolean): ConversationView {
    // In single-vendor mode customers only ever talk to "the store", shown under the brand name.
    const showShop = multiVendor || !c.seller.isHouseStore;
    return {
      id: c.id,
      shop: {
        id: c.seller.id,
        name: showShop ? c.seller.shopName : BRAND.name,
        slug: c.seller.slug,
        logoUrl: showShop ? c.seller.logoUrl : null,
        isHouseStore: c.seller.isHouseStore,
      },
      customer: c.customer,
      lastMessage: c.lastMessageSide
        ? { body: c.lastMessagePreview, side: toSide(c.lastMessageSide), createdAt: c.lastMessageAt.toISOString() }
        : null,
      unread: viewerSide === 'customer' ? c.customerUnread : c.sellerUnread,
      otherLastReadAt: (viewerSide === 'customer' ? c.sellerLastReadAt : c.customerLastReadAt)?.toISOString() ?? null,
      viewerSide,
      createdAt: c.createdAt.toISOString(),
    };
  }

  private toMessage(m: MessageRow): ChatMessageView {
    return {
      id: m.id,
      side: toSide(m.side),
      body: m.body,
      product: m.product
        ? {
            id: m.product.id,
            slug: m.product.slug,
            title: m.product.title,
            imageUrl: m.product.images[0]?.url ?? null,
            price: m.product.variants[0]?.price ?? 0,
          }
        : null,
      createdAt: m.createdAt.toISOString(),
    };
  }

  // ───────── Access ─────────

  /** Which side the user is on in a thread; 404 for outsiders so thread ids do not leak. */
  private async sideOf(actor: AuthUserContext, c: ConversationRow): Promise<ChatSide> {
    if (c.customerId === actor.id) return 'customer';
    if (c.seller.isHouseStore && (actor.role === 'ADMIN' || c.seller.userId === actor.id)) return 'seller';
    if (c.seller.userId === actor.id) {
      // Marketplace sellers can use chat only while multi-vendor mode is on and their shop is active.
      await this.mode.assertMultiVendor();
      await this.access.requireActiveSeller(actor.id);
      return 'seller';
    }
    throw new NotFoundException('Conversation not found');
  }

  private async load(actor: AuthUserContext, id: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id }, include: conversationInclude });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return { conversation, side: await this.sideOf(actor, conversation) };
  }

  /** Users who answer for the shop: the seller, or every active admin for the house store. */
  private async shopUserIds(c: ConversationRow): Promise<string[]> {
    if (!c.seller.isHouseStore) return [c.seller.userId];
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    return [c.seller.userId, ...admins.map((a) => a.id)];
  }

  /** The caller's side and the other side's users (for real-time events). */
  async participants(actor: AuthUserContext, id: string) {
    const { conversation, side } = await this.load(actor, id);
    const shop = await this.shopUserIds(conversation);
    return {
      side,
      otherUserIds: side === 'customer' ? shop : [conversation.customerId],
      allUserIds: [conversation.customerId, ...shop],
    };
  }

  // ───────── Customer ─────────

  async start(userId: string, input: StartInput): Promise<ConversationView> {
    const multiVendor = await this.mode.isMultiVendor();
    const visibleSeller = await this.mode.visibleSellerWhere();

    let sellerId: string;
    if (input.productId) {
      const product = await this.prisma.product.findFirst({
        where: { AND: [{ id: input.productId }, await this.mode.visibleProductWhere()] },
        select: { sellerId: true, seller: { select: { slug: true } } },
      });
      if (!product) throw new NotFoundException('Product not found');
      if (input.sellerSlug && input.sellerSlug !== product.seller.slug) {
        throw new BadRequestException('This product belongs to a different shop');
      }
      sellerId = product.sellerId;
    } else if (input.sellerSlug && multiVendor) {
      const seller = await this.prisma.sellerProfile.findFirst({ where: { AND: [{ slug: input.sellerSlug }, visibleSeller] } });
      if (!seller) throw new NotFoundException('Shop not found');
      sellerId = seller.id;
    } else {
      sellerId = (await this.access.houseStore()).id;
    }

    const seller = await this.prisma.sellerProfile.findUniqueOrThrow({ where: { id: sellerId }, select: { userId: true } });
    if (seller.userId === userId) throw new BadRequestException('You cannot message your own shop');

    const conversation = await this.prisma.conversation.upsert({
      where: { customerId_sellerId: { customerId: userId, sellerId } },
      create: { customerId: userId, sellerId },
      update: {},
      include: conversationInclude,
    });
    return this.toConversation(conversation, 'customer', multiVendor);
  }

  async customerList(userId: string, query: ListQuery) {
    // Threads with shops that are hidden in the current mode are hidden too (not deleted).
    const where: Prisma.ConversationWhereInput = { customerId: userId, seller: await this.mode.visibleSellerWhere() };
    return this.page(where, query, 'customer');
  }

  // ───────── Shop side ─────────

  async sellerList(userId: string, query: ListQuery) {
    const seller = await this.access.requireActiveSeller(userId);
    return this.page({ sellerId: seller.id, lastMessageSide: { not: null } }, query, 'seller');
  }

  async storeList(query: ListQuery) {
    const house = await this.access.houseStore();
    return this.page({ sellerId: house.id, lastMessageSide: { not: null } }, query, 'seller');
  }

  private async page(where: Prisma.ConversationWhereInput, query: ListQuery, side: ChatSide) {
    const [rows, total, multiVendor] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: conversationInclude,
        orderBy: { lastMessageAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.conversation.count({ where }),
      this.mode.isMultiVendor(),
    ]);
    return PaginatedResult.of(
      rows.map((r) => this.toConversation(r, side, multiVendor)),
      query.page,
      query.limit,
      total,
    );
  }

  // ───────── Thread ─────────

  async thread(actor: AuthUserContext, id: string, limit: number): Promise<ChatThread> {
    const { conversation, side } = await this.load(actor, id);
    const [rows, total, multiVendor] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { conversationId: id },
        include: messageInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.chatMessage.count({ where: { conversationId: id } }),
      this.mode.isMultiVendor(),
    ]);
    return {
      conversation: this.toConversation(conversation, side, multiVendor),
      messages: rows.reverse().map((m) => this.toMessage(m)),
      hasMore: total > rows.length,
    };
  }

  async send(actor: AuthUserContext, id: string, input: SendInput): Promise<ChatMessageView> {
    const { conversation, side } = await this.load(actor, id);
    if (side === 'customer') {
      const multiVendor = await this.mode.isMultiVendor();
      if (!this.mode.isSellerVisible(conversation.seller, multiVendor)) {
        throw new ForbiddenException('This shop is not available right now');
      }
    }
    if (input.productId) {
      const product = await this.prisma.product.findFirst({ where: { id: input.productId, sellerId: conversation.sellerId }, select: { id: true } });
      if (!product) throw new BadRequestException('You can only share products from this shop');
    }

    const now = new Date();
    const dbSide = side === 'customer' ? 'CUSTOMER' : 'SELLER';
    const otherUnreadBefore = side === 'customer' ? conversation.sellerUnread : conversation.customerUnread;
    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: { conversationId: id, senderId: actor.id, side: dbSide, body: input.body, productId: input.productId ?? null },
        include: messageInclude,
      }),
      this.prisma.conversation.update({
        where: { id },
        data: {
          lastMessageAt: now,
          lastMessagePreview: input.body.slice(0, PREVIEW_LENGTH),
          lastMessageSide: dbSide,
          // The sender has obviously read the thread; the other side gets one more unread message.
          ...(side === 'customer'
            ? { sellerUnread: { increment: 1 }, customerUnread: 0, customerLastReadAt: now }
            : { customerUnread: { increment: 1 }, sellerUnread: 0, sellerLastReadAt: now }),
        },
      }),
    ]);

    const view = this.toMessage(message);
    // Both sides (and the sender's other tabs/devices) get the message instantly.
    this.realtime.emit([conversation.customerId, ...(await this.shopUserIds(conversation))], 'chat:message', {
      conversationId: id,
      message: view,
    });
    // One notification per unread streak, not one per message.
    if (otherUnreadBefore === 0) await this.notifyOtherSide(conversation, side, input.body);
    return view;
  }

  async markRead(actor: AuthUserContext, id: string): Promise<void> {
    const { conversation, side } = await this.load(actor, id);
    const now = new Date();
    await this.prisma.conversation.update({
      where: { id },
      data: side === 'customer' ? { customerUnread: 0, customerLastReadAt: now } : { sellerUnread: 0, sellerLastReadAt: now },
    });
    // Updates "Seen" for the other side and unread badges on the reader's other devices.
    this.realtime.emit([conversation.customerId, ...(await this.shopUserIds(conversation))], 'chat:read', {
      conversationId: id,
      side,
      at: now.toISOString(),
    });
  }

  // ───────── Unread badges ─────────

  async customerUnread(userId: string): Promise<{ count: number }> {
    const agg = await this.prisma.conversation.aggregate({
      where: { customerId: userId, seller: await this.mode.visibleSellerWhere() },
      _sum: { customerUnread: true },
    });
    return { count: agg._sum.customerUnread ?? 0 };
  }

  async sellerUnread(userId: string): Promise<{ count: number }> {
    const seller = await this.access.requireActiveSeller(userId);
    const agg = await this.prisma.conversation.aggregate({ where: { sellerId: seller.id }, _sum: { sellerUnread: true } });
    return { count: agg._sum.sellerUnread ?? 0 };
  }

  async storeUnread(): Promise<{ count: number }> {
    const house = await this.access.houseStore();
    const agg = await this.prisma.conversation.aggregate({ where: { sellerId: house.id }, _sum: { sellerUnread: true } });
    return { count: agg._sum.sellerUnread ?? 0 };
  }

  private async notifyOtherSide(c: ConversationRow, senderSide: ChatSide, body: string) {
    const preview = body.slice(0, 100);
    if (senderSide === 'seller') {
      const multiVendor = await this.mode.isMultiVendor();
      const from = multiVendor || !c.seller.isHouseStore ? c.seller.shopName : BRAND.name;
      await this.notifications.notify(c.customerId, 'CHAT', `New message from ${from}`, preview, { conversationId: c.id });
      return;
    }
    const recipients = [...new Set(await this.shopUserIds(c))];
    await Promise.all(
      recipients.map((uid) =>
        this.notifications.notify(uid, 'CHAT', `New message from ${c.customer.name}`, preview, { conversationId: c.id }),
      ),
    );
  }
}
