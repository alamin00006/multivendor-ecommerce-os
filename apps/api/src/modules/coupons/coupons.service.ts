import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CouponPayload, CouponView, MyVoucherView, SellerCouponPayload } from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';
import { type CouponCheck, evaluateCoupon, type VoucherContext } from './coupon-calculator.js';

type Db = PrismaService | Prisma.TransactionClient;

const couponInclude = {
  seller: { select: { id: true, shopName: true, slug: true, logoUrl: true, status: true, isHouseStore: true } },
} satisfies Prisma.CouponInclude;
type CouponRow = Prisma.CouponGetPayload<{ include: typeof couponInclude }>;

export const toCouponView = (c: CouponRow, collected = false): CouponView => ({
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
  scope: c.scope,
  seller: c.seller ? { id: c.seller.id, shopName: c.seller.shopName, slug: c.seller.slug, logoUrl: c.seller.logoUrl } : null,
  paymentMethod: c.paymentMethod,
  collected,
});

/** Common columns from either form (admin or seller). */
const baseData = (input: SellerCouponPayload) => ({
  code: input.code,
  description: input.description,
  type: input.type,
  value: Number(input.value),
  minOrderAmount: input.minOrderAmount ?? 0,
  // A cap only makes sense for percentages.
  maxDiscount: input.type === 'PERCENTAGE' ? (input.maxDiscount ?? null) : null,
  usageLimit: input.usageLimit != null ? Number(input.usageLimit) : null,
  perUserLimit: Number(input.perUserLimit ?? 1),
  startsAt: new Date(input.startsAt as Date),
  endsAt: new Date(input.endsAt as Date),
  isActive: input.isActive ?? true,
});

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: PlatformModeService,
    private readonly access: SellerAccessService,
  ) {}

  /** Currently running and not used up. */
  private liveWhere(now = new Date()): Prisma.CouponWhereInput {
    return { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } };
  }

  /** Store vouchers follow their shop's visibility (hidden in single-vendor mode, or when suspended). */
  private async visibleWhere(): Promise<Prisma.CouponWhereInput> {
    return { OR: [{ sellerId: null }, { seller: await this.mode.visibleSellerWhere() }] };
  }

  /** Resolves a voucher for this user and order. Returns the evaluation, or why it cannot be used. */
  async check(
    code: string,
    userId: string,
    ctx: VoucherContext,
    db: Db = this.prisma,
  ): Promise<{ coupon: CouponRow; result: Extract<CouponCheck, { ok: true }> } | { error: string }> {
    const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() }, include: couponInclude });
    if (!coupon) return { error: 'Voucher not found' };
    if (coupon.seller && !this.mode.isSellerVisible(coupon.seller, await this.mode.isMultiVendor())) {
      return { error: 'This voucher is not available right now' };
    }
    const userUses = await db.couponRedemption.count({ where: { couponId: coupon.id, userId } });
    const result = evaluateCoupon(coupon, { ...ctx, shopName: coupon.seller?.shopName }, userUses);
    return result.ok ? { coupon, result } : { error: result.reason };
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
    if (count === 0) throw new BadRequestException('This voucher has just been fully redeemed');
    await tx.couponRedemption.create({ data: { couponId, userId, orderId } });
  }

  // ───── Customers ─────

  /** Vouchers anyone can use right now; `collected` is set for the signed-in viewer. */
  async available(userId?: string): Promise<CouponView[]> {
    const rows = await this.prisma.coupon.findMany({
      where: { AND: [this.liveWhere(), await this.visibleWhere()] },
      include: { ...couponInclude, ...(userId ? { collections: { where: { userId }, select: { userId: true } } } : {}) },
      orderBy: [{ scope: 'asc' }, { endsAt: 'asc' }],
    });
    return rows
      .filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit)
      .map((c) => toCouponView(c, Boolean((c as { collections?: unknown[] }).collections?.length)));
  }

  /** Saves a running voucher to the customer's wallet (idempotent). */
  async collect(userId: string, couponId: string): Promise<CouponView> {
    const coupon = await this.prisma.coupon.findFirst({
      where: { AND: [{ id: couponId }, this.liveWhere(), await this.visibleWhere()] },
      include: couponInclude,
    });
    if (!coupon || (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)) {
      throw new NotFoundException('This voucher is no longer available');
    }
    await this.prisma.couponCollection.upsert({
      where: { userId_couponId: { userId, couponId } },
      create: { userId, couponId },
      update: {},
    });
    return toCouponView(coupon, true);
  }

  /** The customer's wallet, newest first, each with whether it can still be used. */
  async mine(userId: string): Promise<MyVoucherView[]> {
    const [rows, multiVendor] = await Promise.all([
      this.prisma.couponCollection.findMany({
        where: { userId },
        include: { coupon: { include: { ...couponInclude, redemptions: { where: { userId }, select: { id: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.mode.isMultiVendor(),
    ]);
    const now = new Date();
    return rows.map(({ coupon, createdAt }) => {
      const expired =
        !coupon.isActive ||
        coupon.endsAt <= now ||
        (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) ||
        (coupon.seller !== null && !this.mode.isSellerVisible(coupon.seller, multiVendor));
      const used = coupon.redemptions.length >= coupon.perUserLimit;
      return {
        ...toCouponView(coupon, true),
        collectedAt: createdAt.toISOString(),
        status: used ? 'USED' : expired ? 'EXPIRED' : 'AVAILABLE',
      };
    });
  }

  // ───── Admin ─────

  async list(): Promise<CouponView[]> {
    return (await this.prisma.coupon.findMany({ include: couponInclude, orderBy: { createdAt: 'desc' } })).map((c) => toCouponView(c));
  }

  private async adminData(input: CouponPayload) {
    if (input.scope === 'STORE') {
      const seller = await this.prisma.sellerProfile.findUnique({ where: { id: input.sellerId ?? '' }, select: { id: true } });
      if (!seller) throw new BadRequestException('Shop not found');
    }
    return {
      ...baseData(input),
      scope: input.scope,
      sellerId: input.scope === 'STORE' ? (input.sellerId ?? null) : null,
      paymentMethod: input.scope === 'PAYMENT' ? (input.paymentMethod ?? null) : null,
    };
  }

  async create(input: CouponPayload): Promise<CouponView> {
    return toCouponView(await this.prisma.coupon.create({ data: await this.adminData(input), include: couponInclude }));
  }

  async update(id: string, input: CouponPayload): Promise<CouponView> {
    return toCouponView(await this.prisma.coupon.update({ where: { id }, data: await this.adminData(input), include: couponInclude }));
  }

  async remove(id: string): Promise<void> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!coupon) throw new NotFoundException('Voucher not found');
    // Used vouchers stay for order history; they are switched off instead.
    if (coupon._count.redemptions > 0) {
      await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
      return;
    }
    await this.prisma.coupon.delete({ where: { id } });
  }

  // ───── Sellers (own STORE vouchers only) ─────

  async sellerList(userId: string): Promise<CouponView[]> {
    const seller = await this.access.requireActiveSeller(userId);
    const rows = await this.prisma.coupon.findMany({ where: { sellerId: seller.id }, include: couponInclude, orderBy: { createdAt: 'desc' } });
    return rows.map((c) => toCouponView(c));
  }

  async sellerCreate(userId: string, input: SellerCouponPayload): Promise<CouponView> {
    const seller = await this.access.requireActiveSeller(userId);
    return toCouponView(
      await this.prisma.coupon.create({ data: { ...baseData(input), scope: 'STORE', sellerId: seller.id }, include: couponInclude }),
    );
  }

  private async ownCoupon(userId: string, id: string) {
    const seller = await this.access.requireActiveSeller(userId);
    const coupon = await this.prisma.coupon.findUnique({ where: { id }, select: { sellerId: true } });
    if (!coupon) throw new NotFoundException('Voucher not found');
    if (coupon.sellerId !== seller.id) throw new ForbiddenException('You can only manage your own shop vouchers');
    return seller;
  }

  async sellerUpdate(userId: string, id: string, input: SellerCouponPayload): Promise<CouponView> {
    const seller = await this.ownCoupon(userId, id);
    return toCouponView(
      await this.prisma.coupon.update({ where: { id }, data: { ...baseData(input), scope: 'STORE', sellerId: seller.id }, include: couponInclude }),
    );
  }

  async sellerRemove(userId: string, id: string): Promise<void> {
    await this.ownCoupon(userId, id);
    await this.remove(id);
  }
}
