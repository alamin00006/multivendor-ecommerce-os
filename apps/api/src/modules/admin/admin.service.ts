import type { z } from 'zod';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  type AdminDashboard,
  type AdminUpdateUserInput,
  type AdminUserView,
  type OrderStatus,
  UserListQuerySchema,
} from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TokenService } from '../auth/token.service.js';
import { orderSummaryInclude, toOrderSummary } from '../orders/order.mapper.js';

const DAY = 24 * 60 * 60 * 1000;
const REVENUE_EXCLUDED: OrderStatus[] = ['CANCELLED', 'RETURNED', 'REFUNDED'];

type ListQuery = z.infer<typeof UserListQuerySchema>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async dashboard(): Promise<AdminDashboard> {
    const since = new Date(Date.now() - 29 * DAY);
    since.setUTCHours(0, 0, 0, 0);
    const counted: Prisma.OrderWhereInput = { status: { notIn: REVENUE_EXCLUDED } };

    const [
      revenue,
      ordersCount,
      customersCount,
      sellersCount,
      pendingSellers,
      productsCount,
      commission,
      byStatus,
      recent,
      daily,
    ] = await Promise.all([
      this.prisma.order.aggregate({ where: counted, _sum: { total: true } }),
      this.prisma.order.count(),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.sellerProfile.count({ where: { status: 'APPROVED', isHouseStore: false } }),
      this.prisma.sellerProfile.count({ where: { status: 'PENDING' } }),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subOrder.aggregate({
        where: { status: { notIn: REVENUE_EXCLUDED } },
        _sum: { commissionAmount: true },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: true }),
      this.prisma.order.findMany({ include: orderSummaryInclude, orderBy: { createdAt: 'desc' }, take: 8 }),
      this.prisma.$queryRaw<Array<{ day: Date; total: bigint; orders: bigint }>>`
          SELECT date_trunc('day', "createdAt") AS day, COALESCE(SUM(total), 0)::bigint AS total, COUNT(*)::bigint AS orders
          FROM "Order"
          WHERE "createdAt" >= ${since} AND status NOT IN ('CANCELLED', 'RETURNED', 'REFUNDED')
          GROUP BY 1 ORDER BY 1`,
    ]);

    const byDay = new Map(daily.map((d) => [d.day.toISOString().slice(0, 10), d]));
    const salesLast30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(since.getTime() + i * DAY).toISOString().slice(0, 10);
      const row = byDay.get(date);
      return { date, total: Number(row?.total ?? 0), orders: Number(row?.orders ?? 0) };
    });

    return {
      revenue: revenue._sum.total ?? 0,
      ordersCount,
      customersCount,
      sellersCount,
      pendingSellers,
      productsCount,
      commissionEarned: commission._sum.commissionAmount ?? 0,
      ordersByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      salesLast30Days,
      recentOrders: recent.map((o) => toOrderSummary(o, true)),
    };
  }

  async users(query: ListQuery) {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.user.count({ where }),
    ]);
    const items: AdminUserView[] = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      ordersCount: u._count.orders,
      createdAt: u.createdAt.toISOString(),
    }));
    return PaginatedResult.of(items, query.page, query.limit, total);
  }

  async updateUser(actorId: string, id: string, input: AdminUpdateUserInput): Promise<AdminUserView> {
    if (id === actorId && (input.isActive === false || (input.role && input.role !== 'ADMIN'))) {
      throw new BadRequestException('You cannot disable or demote your own account');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: input,
      include: { _count: { select: { orders: true } } },
    });
    if (input.isActive === false || input.role) await this.tokens.revokeAllForUser(id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      ordersCount: user._count.orders,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
