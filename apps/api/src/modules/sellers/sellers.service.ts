import type { z } from 'zod';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LOW_STOCK_THRESHOLD,
  type SellerAdminUpdateInput,
  type SellerDashboard,
  SellerListQuerySchema,
  type SellerProfileView,
  type SellerRegisterInput,
  type ShopView,
  type UpdateShopInput,
} from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { num, randomSuffix, slugify } from '../../common/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { sellerOrderInclude, toSellerOrderView } from '../orders/order.mapper.js';
import { SellerAccessService } from './seller-access.service.js';

const profileInclude = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  _count: { select: { products: true } },
} satisfies Prisma.SellerProfileInclude;

type ProfileRow = Prisma.SellerProfileGetPayload<{ include: typeof profileInclude }>;

const toShopView = (s: ProfileRow): ShopView => ({
  id: s.id,
  shopName: s.shopName,
  slug: s.slug,
  logoUrl: s.logoUrl,
  ratingAvg: num(s.ratingAvg),
  isHouseStore: s.isHouseStore,
  description: s.description,
  bannerUrl: s.bannerUrl,
  productCount: s._count.products,
  createdAt: s.createdAt.toISOString(),
});

const toProfileView = (s: ProfileRow): SellerProfileView => ({
  ...toShopView(s),
  status: s.status,
  phone: s.phone,
  pickupAddress: s.pickupAddress,
  commissionRate: num(s.commissionRate),
  approvedAt: s.approvedAt?.toISOString() ?? null,
  owner: s.user,
});

@Injectable()
export class SellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SellerAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = slugify(base) || `shop-${randomSuffix()}`;
    while (
      await this.prisma.sellerProfile.findFirst({ where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) } })
    ) {
      slug = `${slugify(base)}-${randomSuffix()}`;
    }
    return slug;
  }

  async register(userId: string, input: SellerRegisterInput): Promise<SellerProfileView> {
    if (await this.prisma.sellerProfile.findUnique({ where: { userId } })) {
      throw new ConflictException('You already have a shop');
    }
    if (input.slug && (await this.prisma.sellerProfile.findUnique({ where: { slug: input.slug } }))) {
      throw new ConflictException('This shop URL is taken');
    }
    const slug = input.slug ?? (await this.uniqueSlug(input.shopName));
    const profile = await this.prisma.sellerProfile.create({
      data: { ...input, slug, userId, status: 'PENDING' },
      include: profileInclude,
    });
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    await Promise.all(
      admins.map((a) =>
        this.notifications.notify(
          a.id,
          'SELLER',
          'New seller application',
          `${profile.shopName} is waiting for approval.`,
          {
            sellerId: profile.id,
          },
        ),
      ),
    );
    return toProfileView(profile);
  }

  async me(userId: string): Promise<SellerProfileView> {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { userId }, include: profileInclude });
    if (!profile) throw new NotFoundException('You do not have a shop yet');
    return toProfileView(profile);
  }

  async updateShop(userId: string, input: UpdateShopInput): Promise<SellerProfileView> {
    const seller = await this.access.requireActiveSeller(userId);
    if (input.slug && input.slug !== seller.slug) {
      if (await this.prisma.sellerProfile.findUnique({ where: { slug: input.slug } })) {
        throw new ConflictException('This shop URL is taken');
      }
    }
    const profile = await this.prisma.sellerProfile.update({
      where: { id: seller.id },
      data: input,
      include: profileInclude,
    });
    return toProfileView(profile);
  }

  async shop(slug: string): Promise<ShopView> {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { slug }, include: profileInclude });
    if (!profile || profile.status !== 'APPROVED') throw new NotFoundException('Shop not found');
    const productCount = await this.prisma.product.count({ where: { sellerId: profile.id, status: 'ACTIVE' } });
    return { ...toShopView(profile), productCount };
  }

  async dashboard(userId: string): Promise<SellerDashboard> {
    const seller = await this.access.requireActiveSeller(userId);
    return this.dashboardFor(seller.id);
  }

  async dashboardFor(sellerId: string): Promise<SellerDashboard> {
    const active: Prisma.SubOrderWhereInput = {
      sellerId,
      status: { notIn: ['CANCELLED', 'RETURNED', 'REFUNDED'] },
    };
    const [sales, ordersCount, pendingOrders, productsCount, lowStock, recent] = await Promise.all([
      this.prisma.subOrder.aggregate({ where: active, _sum: { total: true } }),
      this.prisma.subOrder.count({ where: { sellerId } }),
      this.prisma.subOrder.count({ where: { sellerId, status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] } } }),
      this.prisma.product.count({ where: { sellerId } }),
      this.prisma.productVariant.findMany({
        where: {
          product: { sellerId, status: { not: 'INACTIVE' } },
          isActive: true,
          stock: { lte: LOW_STOCK_THRESHOLD },
        },
        include: { product: { select: { id: true, title: true } } },
        orderBy: { stock: 'asc' },
        take: 20,
      }),
      this.prisma.subOrder.findMany({
        where: { sellerId },
        include: sellerOrderInclude,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    return {
      salesTotal: sales._sum.total ?? 0,
      ordersCount,
      pendingOrders,
      productsCount,
      lowStock: lowStock.map((v) => ({
        productId: v.product.id,
        title: v.product.title,
        sku: v.sku,
        variantId: v.id,
        stock: v.stock,
      })),
      recentOrders: recent.map(toSellerOrderView),
    };
  }

  // ───── Admin ─────

  async adminList(query: z.infer<typeof SellerListQuerySchema>) {
    const where: Prisma.SellerProfileWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { shopName: { contains: query.q, mode: 'insensitive' } },
              { user: { email: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.sellerProfile.findMany({
        where,
        include: profileInclude,
        orderBy: [{ isHouseStore: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.sellerProfile.count({ where }),
    ]);
    return PaginatedResult.of(rows.map(toProfileView), query.page, query.limit, total);
  }

  async adminGet(id: string): Promise<SellerProfileView> {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { id }, include: profileInclude });
    if (!profile) throw new NotFoundException('Seller not found');
    return toProfileView(profile);
  }

  async adminUpdate(id: string, input: SellerAdminUpdateInput): Promise<SellerProfileView> {
    const current = await this.prisma.sellerProfile.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Seller not found');
    if (current.isHouseStore && input.status && input.status !== 'APPROVED') {
      throw new BadRequestException('The house store cannot be suspended');
    }
    const approving = input.status === 'APPROVED' && current.status !== 'APPROVED';
    const profile = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.sellerProfile.update({
        where: { id },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.commissionRate !== undefined ? { commissionRate: input.commissionRate } : {}),
          ...(approving ? { approvedAt: new Date() } : {}),
        },
        include: profileInclude,
      });
      if (approving && !current.isHouseStore) {
        await tx.user.update({ where: { id: current.userId }, data: { role: 'SELLER' } });
      }
      return updated;
    });
    if (input.status && input.status !== current.status) {
      const message =
        input.status === 'APPROVED'
          ? 'Your shop has been approved. Sign in again to open the seller panel.'
          : input.status === 'SUSPENDED'
            ? 'Your shop has been suspended. Contact support for details.'
            : 'Your shop is under review.';
      await this.notifications.notify(current.userId, 'SELLER', 'Shop status updated', message, {
        status: input.status,
      });
    }
    return toProfileView(profile);
  }
}
