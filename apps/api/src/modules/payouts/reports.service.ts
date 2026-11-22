import { Injectable } from '@nestjs/common';
import type { OrderChannel, OrderStatus, SellerReport, SellerReportQuery } from '@marketbd/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';

/** Bangladesh has no daylight saving, so a fixed +06:00 offset gives the local calendar day. */
const BD_OFFSET = 6 * 3_600_000;
const dhakaDay = (d: Date) => new Date(d.getTime() + BD_OFFSET).toISOString().slice(0, 10);
const LOST: OrderStatus[] = ['CANCELLED', 'RETURNED', 'REFUNDED'];

@Injectable()
export class SellerReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SellerAccessService,
  ) {}

  /** Sales report for orders placed between two Dhaka calendar days (inclusive). */
  async report(userId: string, query: SellerReportQuery): Promise<SellerReport> {
    const seller = await this.access.requireActiveSeller(userId);
    const start = new Date(`${query.from}T00:00:00+06:00`);
    const end = new Date(`${query.to}T23:59:59.999+06:00`);
    const subs = await this.prisma.subOrder.findMany({
      where: { sellerId: seller.id, createdAt: { gte: start, lte: end } },
      select: {
        status: true,
        total: true,
        commissionAmount: true,
        createdAt: true,
        order: { select: { channel: true } },
        items: { select: { productId: true, title: true, imageUrl: true, quantity: true, lineTotal: true } },
      },
    });

    const days = new Map<string, { orders: number; gross: number; net: number }>();
    for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) days.set(dhakaDay(new Date(t)), { orders: 0, gross: 0, net: 0 });
    const products = new Map<string, SellerReport['topProducts'][number]>();
    const statuses = new Map<OrderStatus, number>();
    const channels = new Map<OrderChannel, { orders: number; gross: number }>();
    const totals = { orders: 0, units: 0, gross: 0, commission: 0, net: 0, avgOrder: 0, cancelled: 0, returned: 0 };

    for (const s of subs) {
      statuses.set(s.status, (statuses.get(s.status) ?? 0) + 1);
      if (s.status === 'CANCELLED') totals.cancelled += 1;
      if (s.status === 'RETURNED' || s.status === 'REFUNDED') totals.returned += 1;
      if (LOST.includes(s.status)) continue;
      const net = s.total - s.commissionAmount;
      totals.orders += 1;
      totals.gross += s.total;
      totals.commission += s.commissionAmount;
      totals.net += net;
      const day = days.get(dhakaDay(s.createdAt));
      if (day) {
        day.orders += 1;
        day.gross += s.total;
        day.net += net;
      }
      const ch = channels.get(s.order.channel) ?? { orders: 0, gross: 0 };
      ch.orders += 1;
      ch.gross += s.total;
      channels.set(s.order.channel, ch);
      for (const i of s.items) {
        totals.units += i.quantity;
        const p = products.get(i.productId) ?? { productId: i.productId, title: i.title, imageUrl: i.imageUrl, units: 0, gross: 0 };
        p.units += i.quantity;
        p.gross += i.lineTotal;
        products.set(i.productId, p);
      }
    }
    totals.avgOrder = totals.orders ? Math.round(totals.gross / totals.orders) : 0;

    return {
      from: query.from,
      to: query.to,
      totals,
      daily: [...days.entries()].map(([date, v]) => ({ date, ...v })),
      topProducts: [...products.values()].sort((a, b) => b.units - a.units || b.gross - a.gross).slice(0, 10),
      byStatus: [...statuses.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
      byChannel: [...channels.entries()].map(([channel, v]) => ({ channel, ...v })),
    };
  }
}
