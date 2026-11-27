import { Injectable } from '@nestjs/common';
import type { AdminReport, OrderChannel, OrderStatus, PaymentMethod, SellerReport, SellerReportQuery } from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';

/** Bangladesh has no daylight saving, so a fixed +06:00 offset gives the local calendar day. */
const BD_OFFSET = 6 * 3_600_000;
const dhakaDay = (d: Date) => new Date(d.getTime() + BD_OFFSET).toISOString().slice(0, 10);
const LOST: OrderStatus[] = ['CANCELLED', 'RETURNED', 'REFUNDED'];

const reportSelect = {
  status: true,
  sellerId: true,
  orderId: true,
  total: true,
  shippingFee: true,
  discount: true,
  commissionAmount: true,
  createdAt: true,
  seller: { select: { shopName: true } },
  order: { select: { channel: true, paymentMethod: true, userId: true } },
  items: { select: { productId: true, title: true, imageUrl: true, quantity: true, lineTotal: true, product: { select: { categoryId: true } } } },
} satisfies Prisma.SubOrderSelect;

type Row = Prisma.SubOrderGetPayload<{ select: typeof reportSelect }>;

const range = (query: SellerReportQuery) => ({
  start: new Date(`${query.from}T00:00:00+06:00`),
  end: new Date(`${query.to}T23:59:59.999+06:00`),
});

/** Sales figures shared by the seller report (net = seller earnings) and the admin report. */
function baseReport(query: SellerReportQuery, subs: Row[]): SellerReport {
  const { start, end } = range(query);
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

@Injectable()
export class SellerReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SellerAccessService,
  ) {}

  private rows(where: Prisma.SubOrderWhereInput, query: SellerReportQuery) {
    const { start, end } = range(query);
    return this.prisma.subOrder.findMany({ where: { ...where, createdAt: { gte: start, lte: end } }, select: reportSelect });
  }

  /** Sales report for orders placed between two Dhaka calendar days (inclusive). */
  async report(userId: string, query: SellerReportQuery): Promise<SellerReport> {
    const seller = await this.access.requireActiveSeller(userId);
    return baseReport(query, await this.rows({ sellerId: seller.id }, query));
  }

  /**
   * Marketplace-wide report: the seller figures plus a split by shop, category and payment method.
   * In the daily series `net` is the platform's commission.
   */
  async adminReport(query: SellerReportQuery): Promise<AdminReport> {
    const subs = await this.rows({}, query);
    const base = baseReport(query, subs);
    const { start, end } = range(query);

    const sellers = new Map<string, AdminReport['bySeller'][number]>();
    const categoryOf = new Map<string, { units: number; gross: number }>();
    const payments = new Map<PaymentMethod, { orders: Set<string>; gross: number }>();
    const customers = new Set<string>();
    let shipping = 0;
    let discount = 0;
    const daily = new Map(base.daily.map((d) => [d.date, { ...d, net: 0 }]));

    for (const s of subs) {
      if (LOST.includes(s.status)) continue;
      customers.add(s.order.userId);
      shipping += s.shippingFee;
      discount += s.discount;
      const day = daily.get(dhakaDay(s.createdAt));
      if (day) day.net += s.commissionAmount;
      const row = sellers.get(s.sellerId) ?? { sellerId: s.sellerId, shopName: s.seller.shopName, orders: 0, gross: 0, commission: 0 };
      row.orders += 1;
      row.gross += s.total;
      row.commission += s.commissionAmount;
      sellers.set(s.sellerId, row);
      const pay = payments.get(s.order.paymentMethod) ?? { orders: new Set<string>(), gross: 0 };
      pay.orders.add(s.orderId);
      pay.gross += s.total;
      payments.set(s.order.paymentMethod, pay);
      for (const i of s.items) {
        const c = categoryOf.get(i.product.categoryId) ?? { units: 0, gross: 0 };
        c.units += i.quantity;
        c.gross += i.lineTotal;
        categoryOf.set(i.product.categoryId, c);
      }
    }

    // Roll sub-categories up to their top-level category.
    const cats = await this.prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
    const byId = new Map(cats.map((c) => [c.id, c]));
    const topOf = (id: string) => {
      let c = byId.get(id);
      while (c?.parentId && byId.get(c.parentId)) c = byId.get(c.parentId);
      return c;
    };
    const categories = new Map<string, AdminReport['byCategory'][number]>();
    for (const [id, v] of categoryOf) {
      const top = topOf(id);
      const key = top?.id ?? 'other';
      const row = categories.get(key) ?? { categoryId: key, name: top?.name ?? 'Other', units: 0, gross: 0 };
      row.units += v.units;
      row.gross += v.gross;
      categories.set(key, row);
    }

    const newCustomers = customers.size
      ? await this.prisma.user.count({ where: { id: { in: [...customers] }, createdAt: { gte: start, lte: end } } })
      : 0;

    return {
      ...base,
      totals: { ...base.totals, customers: customers.size, newCustomers, shipping, discount },
      daily: [...daily.values()],
      bySeller: [...sellers.values()].sort((a, b) => b.gross - a.gross),
      byCategory: [...categories.values()].sort((a, b) => b.gross - a.gross),
      byPayment: [...payments.entries()].map(([method, v]) => ({ method, orders: v.orders.size, gross: v.gross })).sort((a, b) => b.gross - a.gross),
    };
  }
}
