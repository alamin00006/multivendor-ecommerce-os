import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type ReviewPayload, ReviewListQuerySchema, type ReviewSummary, type ReviewView } from '@marketbd/shared';
import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';

const reviewInclude = {
  user: { select: { name: true, avatarUrl: true } },
  images: true,
  product: { select: { id: true, slug: true, title: true } },
} satisfies Prisma.ReviewInclude;

type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

/** Shows only the first name + initial of reviewers for privacy. */
const displayName = (name: string) => {
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last.charAt(0)}.` : (first ?? 'Customer');
};

const toView = (r: ReviewRow, withProduct = false): ReviewView => ({
  id: r.id,
  rating: r.rating,
  comment: r.comment,
  images: r.images.map((i) => i.url),
  isVerifiedPurchase: r.isVerifiedPurchase,
  isVisible: r.isVisible,
  user: { name: displayName(r.user.name), avatarUrl: r.user.avatarUrl },
  ...(withProduct ? { product: r.product } : {}),
  createdAt: r.createdAt.toISOString(),
});

type ListQuery = z.infer<typeof ReviewListQuerySchema>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: PlatformModeService,
  ) {}

  async list(productId: string, query: ListQuery) {
    const where: Prisma.ReviewWhereInput = {
      productId,
      isVisible: true,
      ...(query.rating ? { rating: query.rating } : {}),
      ...(query.withImages ? { images: { some: {} } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.review.count({ where }),
    ]);
    return PaginatedResult.of(
      rows.map((r) => toView(r)),
      query.page,
      query.limit,
      total,
    );
  }

  async summary(productId: string): Promise<ReviewSummary> {
    const groups = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId, isVisible: true },
      _count: true,
    });
    const distribution: ReviewSummary['distribution'] = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let count = 0;
    let sum = 0;
    for (const g of groups) {
      distribution[String(g.rating) as keyof typeof distribution] = g._count;
      count += g._count;
      sum += g.rating * g._count;
    }
    return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, distribution };
  }

  async create(userId: string, input: ReviewPayload): Promise<ReviewView> {
    const product = await this.prisma.product.findFirst({
      where: { AND: [{ id: input.productId }, await this.mode.visibleProductWhere()] },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (await this.prisma.review.findUnique({ where: { userId_productId: { userId, productId: input.productId } } })) {
      throw new ConflictException('You have already reviewed this product');
    }
    // Verified when the user has a delivered order item for this product that isn't reviewed yet.
    const purchased = await this.prisma.orderItem.findFirst({
      where: {
        productId: input.productId,
        review: null,
        order: { userId },
        subOrder: { status: 'DELIVERED' },
      },
      select: { id: true },
    });
    const review = await this.prisma.review.create({
      data: {
        productId: input.productId,
        userId,
        rating: Number(input.rating),
        comment: input.comment,
        orderItemId: purchased?.id ?? null,
        isVerifiedPurchase: Boolean(purchased),
        images: { create: (input.imageUrls ?? []).map((url) => ({ url })) },
      },
      include: reviewInclude,
    });
    await this.refreshRatings(input.productId);
    return toView(review);
  }

  /** Recomputes product and seller rating aggregates from visible reviews. */
  async refreshRatings(productId: string): Promise<void> {
    const agg = await this.prisma.review.aggregate({
      where: { productId, isVisible: true },
      _avg: { rating: true },
      _count: true,
    });
    const product = await this.prisma.product.update({
      where: { id: productId },
      data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
      select: { sellerId: true },
    });
    const sellerAgg = await this.prisma.review.aggregate({
      where: { isVisible: true, product: { sellerId: product.sellerId } },
      _avg: { rating: true },
    });
    await this.prisma.sellerProfile.update({
      where: { id: product.sellerId },
      data: { ratingAvg: Math.round((sellerAgg._avg.rating ?? 0) * 10) / 10 },
    });
  }

  // ───── Admin ─────

  async adminList(query: { page: number; limit: number }) {
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.review.count(),
    ]);
    return PaginatedResult.of(
      rows.map((r) => toView(r, true)),
      query.page,
      query.limit,
      total,
    );
  }

  async moderate(id: string, isVisible: boolean): Promise<ReviewView> {
    const review = await this.prisma.review.update({ where: { id }, data: { isVisible }, include: reviewInclude });
    await this.refreshRatings(review.productId);
    return toView(review, true);
  }
}
