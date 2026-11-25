import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminPayoutUpdateInput,
  type EarningRow,
  MIN_PAYOUT,
  type PayoutAccount,
  type PayoutAccountView,
  type PayoutRequestInput,
  type PayoutView,
  type SellerEarnings,
} from '@marketbd/shared';
import type { Payout, Prisma } from '../../generated/prisma/client.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { num } from '../../common/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';

const DAY = 86_400_000;
/** Sub-orders that earn money: delivered, or delivered with a return being looked at. */
const EARNING_STATUSES = ['DELIVERED', 'RETURN_REQUESTED'] as const;
const OPEN_RETURN = ['REQUESTED', 'APPROVED'] as const;
/** Earning packages, minus ones admin found were never delivered. */
const EARNING_WHERE = {
  status: { in: [...EARNING_STATUSES] },
  OR: [{ disputeResolution: null }, { disputeResolution: { not: 'NOT_DELIVERED' } }],
} satisfies Prisma.SubOrderWhereInput;

const earningSelect = {
  id: true,
  orderId: true,
  status: true,
  total: true,
  commissionRate: true,
  commissionAmount: true,
  sellerCollectsCash: true,
  disputedAt: true,
  disputeResolution: true,
  order: { select: { orderNumber: true, channel: true } },
  history: { where: { toStatus: 'DELIVERED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
  returns: { where: { status: { in: [...OPEN_RETURN] } }, select: { id: true } },
} satisfies Prisma.SubOrderSelect;
type EarningSubOrder = Prisma.SubOrderGetPayload<{ select: typeof earningSelect }>;

const toPayoutView = (p: Payout): PayoutView => ({
  id: p.id,
  amount: p.amount,
  status: p.status,
  method: p.method,
  accountName: p.accountName,
  accountNumber: p.accountNumber,
  bankName: p.bankName,
  branch: p.branch,
  sellerNote: p.sellerNote,
  adminNote: p.adminNote,
  reference: p.reference,
  processedAt: p.processedAt?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
});

/**
 * Seller earnings and payouts.
 * The platform collects online and COD payments, so each delivered package earns (total − commission).
 * It is held for the return window, then becomes available to withdraw. Counter (POS) sales were paid
 * to the shop in cash, so they only owe the commission, which is taken from the balance straight away.
 * The same goes for COD packages the shop delivered with its own courier (the courier pays the shop).
 * A package the customer says never arrived is held until admin decides; if it really was not
 * delivered it earns nothing.
 */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SellerAccessService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  private row(s: EarningSubOrder, holdDays: number, now: number): EarningRow {
    // Cash already with the shop: only the commission is owed, and it is owed right away.
    const pos = s.order.channel === 'POS' || s.sellerCollectsCash;
    const delivered = s.history[0]?.createdAt ?? null;
    const openDispute = Boolean(s.disputedAt) && !s.disputeResolution;
    const openReturn = s.status === 'RETURN_REQUESTED' || s.returns.length > 0 || openDispute;
    const releaseAt = delivered ? delivered.getTime() + holdDays * DAY : null;
    const available = (pos && !openDispute) || (!openReturn && releaseAt !== null && releaseAt <= now);
    return {
      subOrderId: s.id,
      orderId: s.orderId,
      orderNumber: s.order.orderNumber,
      channel: s.order.channel,
      deliveredAt: delivered?.toISOString() ?? null,
      total: s.total,
      commissionRate: num(s.commissionRate),
      commissionAmount: s.commissionAmount,
      net: pos ? -s.commissionAmount : s.total - s.commissionAmount,
      state: available ? 'AVAILABLE' : 'ON_HOLD',
      availableOn: available || openReturn || releaseAt === null ? null : new Date(releaseAt).toISOString(),
    };
  }

  async summaryFor(sellerId: string): Promise<SellerEarnings> {
    const [seller, holdDays, subs, payouts] = await Promise.all([
      this.prisma.sellerProfile.findUniqueOrThrow({ where: { id: sellerId }, select: { payoutAccount: true } }),
      this.settings.returnDays(),
      this.prisma.subOrder.findMany({ where: { sellerId, ...EARNING_WHERE }, select: earningSelect }),
      this.prisma.payout.groupBy({ by: ['status'], where: { sellerId }, _sum: { amount: true } }),
    ]);
    const adjustments = (await this.prisma.sellerAdjustment.aggregate({ where: { sellerId }, _sum: { amount: true } }))._sum.amount ?? 0;
    const now = Date.now();
    const rows = subs.map((s) => this.row(s, holdDays, now));
    const sum = (list: EarningRow[], f: (r: EarningRow) => number) => list.reduce((t, r) => t + f(r), 0);
    const paid = (status: Payout['status']) => payouts.find((p) => p.status === status)?._sum.amount ?? 0;
    const cleared = sum(rows.filter((r) => r.state === 'AVAILABLE'), (r) => r.net);
    const requested = paid('REQUESTED');
    const paidOut = paid('PAID');
    const balance = cleared + adjustments - requested - paidOut;
    return {
      gross: sum(rows, (r) => r.total),
      commission: sum(rows, (r) => r.commissionAmount),
      net: sum(rows, (r) => r.net),
      onHold: sum(rows.filter((r) => r.state === 'ON_HOLD'), (r) => r.net),
      available: Math.max(0, balance),
      requested,
      paidOut,
      adjustments,
      balance,
      holdDays,
      minPayout: MIN_PAYOUT,
      payoutAccount: (seller.payoutAccount as PayoutAccountView | null) ?? null,
    };
  }

  async summary(userId: string): Promise<SellerEarnings> {
    return this.summaryFor((await this.access.requireActiveSeller(userId)).id);
  }

  async ledger(userId: string, query: { page: number; limit: number }) {
    const seller = await this.access.requireActiveSeller(userId);
    const where: Prisma.SubOrderWhereInput = { sellerId: seller.id, ...EARNING_WHERE };
    const [rows, total, holdDays] = await Promise.all([
      this.prisma.subOrder.findMany({ where, select: earningSelect, orderBy: { updatedAt: 'desc' }, ...skipTake(query.page, query.limit) }),
      this.prisma.subOrder.count({ where }),
      this.settings.returnDays(),
    ]);
    const now = Date.now();
    return PaginatedResult.of(rows.map((s) => this.row(s, holdDays, now)), query.page, query.limit, total);
  }

  async saveAccount(userId: string, account: PayoutAccount): Promise<SellerEarnings> {
    const seller = await this.access.requireActiveSeller(userId);
    const clean: PayoutAccountView = {
      method: account.method,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      ...(account.method === 'BANK' ? { bankName: account.bankName, branch: account.branch || undefined } : {}),
    };
    await this.prisma.sellerProfile.update({ where: { id: seller.id }, data: { payoutAccount: clean as unknown as Prisma.InputJsonValue } });
    return this.summaryFor(seller.id);
  }

  async listMine(userId: string, query: { page: number; limit: number; status?: Payout['status'] }) {
    const seller = await this.access.requireActiveSeller(userId);
    const where: Prisma.PayoutWhereInput = { sellerId: seller.id, ...(query.status ? { status: query.status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.payout.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(query.page, query.limit) }),
      this.prisma.payout.count({ where }),
    ]);
    return PaginatedResult.of(rows.map(toPayoutView), query.page, query.limit, total);
  }

  async request(userId: string, input: PayoutRequestInput & { amount: number }): Promise<PayoutView> {
    const seller = await this.access.requireActiveSeller(userId);
    const account = seller.payoutAccount as PayoutAccountView | null;
    if (!account) throw new BadRequestException('Add your payout account first');
    // Serialise requests per seller so two clicks cannot both pass the balance check.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id = ${seller.id} FOR UPDATE`;
      if (await tx.payout.count({ where: { sellerId: seller.id, status: 'REQUESTED' } }))
        throw new ConflictException('You already have a payout request waiting. Please wait until it is processed.');
      const { available } = await this.summaryFor(seller.id);
      if (input.amount > available) throw new BadRequestException(`You can withdraw up to ৳${(available / 100).toLocaleString('en-US')}`);
      const payout = await tx.payout.create({
        data: {
          sellerId: seller.id,
          amount: input.amount,
          method: account.method,
          accountName: account.accountName,
          accountNumber: account.accountNumber,
          bankName: account.bankName ?? null,
          branch: account.branch ?? null,
          sellerNote: input.note,
        },
      });
      return toPayoutView(payout);
    });
  }

  async cancel(userId: string, id: string): Promise<PayoutView> {
    const seller = await this.access.requireActiveSeller(userId);
    const { count } = await this.prisma.payout.updateMany({
      where: { id, sellerId: seller.id, status: 'REQUESTED' },
      data: { status: 'REJECTED', adminNote: 'Cancelled by the seller', processedAt: new Date() },
    });
    if (!count) throw new NotFoundException('Only waiting requests can be cancelled');
    return toPayoutView(await this.prisma.payout.findUniqueOrThrow({ where: { id } }));
  }

  // ───── Admin ─────

  async listAll(query: { page: number; limit: number; status?: Payout['status'] }) {
    const where: Prisma.PayoutWhereInput = query.status ? { status: query.status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        include: { seller: { select: { id: true, shopName: true, slug: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.payout.count({ where }),
    ]);
    const balances = new Map<string, number>();
    for (const id of new Set(rows.map((r) => r.sellerId))) balances.set(id, (await this.summaryFor(id)).available);
    return PaginatedResult.of(
      rows.map((p) => ({ ...toPayoutView(p), seller: { ...p.seller, available: balances.get(p.sellerId) ?? 0 } })),
      query.page,
      query.limit,
      total,
    );
  }

  async process(actorId: string, id: string, input: AdminPayoutUpdateInput): Promise<PayoutView> {
    const payout = await this.prisma.payout.findUnique({ where: { id }, include: { seller: { select: { userId: true } } } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== 'REQUESTED') throw new ConflictException('This payout was already processed');
    const updated = await this.prisma.payout.update({
      where: { id },
      data: {
        status: input.status,
        reference: input.status === 'PAID' ? input.reference : null,
        adminNote: input.adminNote,
        processedById: actorId,
        processedAt: new Date(),
      },
    });
    const taka = `৳${(payout.amount / 100).toLocaleString('en-US')}`;
    await this.notifications.notify(
      payout.seller.userId,
      'SELLER',
      input.status === 'PAID' ? 'Payout sent' : 'Payout rejected',
      input.status === 'PAID'
        ? `${taka} was sent to your ${payout.method === 'BANK' ? 'bank account' : payout.method.toLowerCase()} (ref ${input.reference}).`
        : `Your payout request of ${taka} was rejected: ${input.adminNote}`,
      { payoutId: id },
    );
    return toPayoutView(updated);
  }
}
