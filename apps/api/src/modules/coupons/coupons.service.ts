import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CouponPayload, CouponView } from '@marketbd/shared';
import type { Coupon, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { evaluateCoupon } from './coupon-calculator.js';

type Db = PrismaService | Prisma.TransactionClient;

export const toCouponView = (c: Coupon): CouponView => ({
  id: c.id,
  code: c.code,
  description: c.description,
  type: c.type,
  value: c.value,
  minOrderAmount: c.minOrderAmount,
  maxDiscount: c.maxDiscount,
  usageLimit: c.usageLimit,
  perUserLimit: c.perUserLimit,
  usedCount: c.usedCount,
  startsAt: c.startsAt.toISOString(),
  endsAt: c.endsAt.toISOString(),
  isActive: c.isActive,
});

const couponData = (input: CouponPayload) => ({
  code: input.code,
  description: input.description,
  type: input.type,
  value: Number(input.value),
  minOrderAmount: input.minOrderAmount ?? 0,
  maxDiscount: input.maxDiscount ?? null,
  usageLimit: input.usageLimit != null ? Number(input.usageLimit) : null,
  perUserLimit: Number(input.perUserLimit ?? 1),
  startsAt: new Date(input.startsAt as Date),
  endsAt: new Date(input.endsAt as Date),
  isActive: input.isActive ?? true,
});

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves a coupon for a user and subtotal. Returns the coupon and discount or the reason it fails. */
  async check(
    code: string,
    userId: string,
    subtotal: number,
    db: Db = this.prisma,
  ): Promise<{ coupon: Coupon; discount: number } | { error: string }> {
    const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon) return { error: 'Coupon not found' };
    const userUses = await db.couponRedemption.count({ where: { couponId: coupon.id, userId } });
    const result = evaluateCoupon(coupon, subtotal, userUses);
    return result.ok ? { coupon, discount: result.discount } : { error: result.reason };
  }

  /** Atomically records a redemption; fails if the global usage limit was reached concurrently. */
  async redeem(tx: Prisma.TransactionClient, couponId: string, userId: string, orderId: string): Promise<void> {
    const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: couponId } });
    const { count } = await tx.coupon.updateMany({
      where: {
        id: couponId,
        ...(coupon.usageLimit !== null ? { usedCount: { lt: coupon.usageLimit } } : {}),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (count === 0) throw new BadRequestException('This coupon has just been fully redeemed');
    await tx.couponRedemption.create({ data: { couponId, userId, orderId } });
  }

  /** Coupons currently available to everyone (shown as vouchers). */
  async available(): Promise<CouponView[]> {
    const now = new Date();
    const rows = await this.prisma.coupon.findMany({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { endsAt: 'asc' },
    });
    return rows.filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit).map(toCouponView);
  }

  // ───── Admin ─────

  async list(): Promise<CouponView[]> {
    return (await this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })).map(toCouponView);
  }

  async create(input: CouponPayload): Promise<CouponView> {
    return toCouponView(await this.prisma.coupon.create({ data: couponData(input) }));
  }

  async update(id: string, input: CouponPayload): Promise<CouponView> {
    return toCouponView(await this.prisma.coupon.update({ where: { id }, data: couponData(input) }));
  }

  async remove(id: string): Promise<void> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (coupon._count.redemptions > 0) {
      await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
      return;
    }
    await this.prisma.coupon.delete({ where: { id } });
  }
}
