import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BRAND, type QuestionListQuerySchema, type QuestionView } from '@marketbd/shared';
import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthUserContext } from '../../common/auth-user.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';

type ListQuery = z.infer<typeof QuestionListQuerySchema>;

const questionInclude = {
  user: { select: { name: true } },
  answeredBy: { select: { role: true, sellerProfile: { select: { shopName: true } } } },
  product: {
    select: {
      id: true,
      slug: true,
      title: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
    },
  },
} satisfies Prisma.ProductQuestionInclude;

type QuestionRow = Prisma.ProductQuestionGetPayload<{ include: typeof questionInclude }>;

/** "Arif Rahman" → "Arif R." — askers are not fully identified in public. */
const shortName = (name: string) => {
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last.charAt(0)}.` : (first ?? 'Customer');
};

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: PlatformModeService,
    private readonly access: SellerAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  private toView(q: QuestionRow, multiVendor: boolean, withProduct = false): QuestionView {
    // A seller's answer shows the shop name in multi-vendor mode; staff answers show the store name.
    const sellerName = q.answeredBy?.role === 'SELLER' ? q.answeredBy.sellerProfile?.shopName : undefined;
    return {
      id: q.id,
      question: q.question,
      answer: q.answer,
      askedBy: { name: shortName(q.user.name) },
      answeredBy: q.answeredAt
        ? multiVendor && sellerName
          ? { name: sellerName, role: 'seller' }
          : { name: BRAND.name, role: 'store' }
        : null,
      answeredAt: q.answeredAt?.toISOString() ?? null,
      isVisible: q.isVisible,
      ...(withProduct
        ? {
            product: {
              id: q.product.id,
              slug: q.product.slug,
              title: q.product.title,
              imageUrl: q.product.images[0]?.url ?? null,
            },
          }
        : {}),
      createdAt: q.createdAt.toISOString(),
    };
  }

  private async page(where: Prisma.ProductQuestionWhereInput, query: ListQuery, withProduct: boolean) {
    const filtered: Prisma.ProductQuestionWhereInput = { ...where, ...(query.unanswered ? { answeredAt: null } : {}) };
    const [rows, total, multiVendor] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where: filtered,
        include: questionInclude,
        orderBy: [{ createdAt: 'desc' }],
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.productQuestion.count({ where: filtered }),
      this.mode.isMultiVendor(),
    ]);
    return PaginatedResult.of(
      rows.map((r) => this.toView(r, multiVendor, withProduct)),
      query.page,
      query.limit,
      total,
    );
  }

  /** Public list for a product page. */
  list(productId: string, query: ListQuery) {
    return this.page({ productId, isVisible: true }, query, false);
  }

  async ask(userId: string, productId: string, question: string): Promise<QuestionView> {
    const product = await this.prisma.product.findFirst({
      where: { AND: [{ id: productId }, await this.mode.visibleProductWhere()] },
      include: { seller: { select: { userId: true, isHouseStore: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    const created = await this.prisma.productQuestion.create({
      data: { productId, userId, question },
      include: questionInclude,
    });

    // Tell whoever can answer: the seller (multi-vendor, not the house store) or the store admins.
    const multiVendor = await this.mode.isMultiVendor();
    const recipients =
      multiVendor && !product.seller.isHouseStore
        ? [product.seller.userId]
        : (await this.prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })).map(
            (a) => a.id,
          );
    await Promise.all(
      recipients.map((id) =>
        this.notifications.notify(
          id,
          'SYSTEM',
          'New customer question',
          `"${question.slice(0, 80)}" on ${product.title}`,
          {
            productId,
            questionId: created.id,
          },
        ),
      ),
    );
    return this.toView(created, multiVendor);
  }

  /** Answers a question. Sellers may answer only questions on their own products. */
  async answer(actor: AuthUserContext, questionId: string, answer: string): Promise<QuestionView> {
    const question = await this.prisma.productQuestion.findUnique({
      where: { id: questionId },
      include: { product: { select: { title: true, slug: true, sellerId: true } } },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (actor.role !== 'ADMIN') {
      const seller = await this.access.requireActiveSeller(actor.id);
      if (seller.id !== question.product.sellerId)
        throw new ForbiddenException('You can only answer questions on your products');
    }
    const updated = await this.prisma.productQuestion.update({
      where: { id: questionId },
      data: { answer, answeredById: actor.id, answeredAt: new Date() },
      include: questionInclude,
    });
    await this.notifications.notify(
      question.userId,
      'SYSTEM',
      'Your question was answered',
      `${question.product.title}: ${answer.slice(0, 100)}`,
      { productSlug: question.product.slug, questionId },
    );
    return this.toView(updated, await this.mode.isMultiVendor(), true);
  }

  async sellerList(userId: string, query: ListQuery) {
    const seller = await this.access.requireActiveSeller(userId);
    return this.page({ product: { sellerId: seller.id } }, query, true);
  }

  adminList(query: ListQuery) {
    return this.page({}, query, true);
  }

  async moderate(questionId: string, isVisible: boolean): Promise<QuestionView> {
    const updated = await this.prisma.productQuestion.update({
      where: { id: questionId },
      data: { isVisible },
      include: questionInclude,
    });
    return this.toView(updated, await this.mode.isMultiVendor(), true);
  }
}
