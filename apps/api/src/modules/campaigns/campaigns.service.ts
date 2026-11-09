import { Injectable, NotFoundException } from '@nestjs/common';
import type { CampaignPayload, CampaignView } from '@marketbd/shared';
import type { Campaign } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const toView = (c: Campaign, productCount: number): CampaignView => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  titleBn: c.titleBn,
  description: c.description,
  bannerUrl: c.bannerUrl,
  mobileBannerUrl: c.mobileBannerUrl,
  themeColor: c.themeColor,
  type: c.type,
  startAt: c.startAt.toISOString(),
  endAt: c.endAt.toISOString(),
  isActive: c.isActive,
  sortOrder: c.sortOrder,
  productCount,
});

const campaignData = (input: CampaignPayload) => ({
  slug: input.slug,
  title: input.title,
  titleBn: input.titleBn,
  description: input.description,
  bannerUrl: input.bannerUrl,
  mobileBannerUrl: input.mobileBannerUrl ?? null,
  themeColor: input.themeColor ?? null,
  type: input.type,
  startAt: new Date(input.startAt as Date),
  endAt: new Date(input.endAt as Date),
  isActive: input.isActive ?? true,
  sortOrder: Number(input.sortOrder ?? 0),
});

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Campaigns live right now (products are fetched via /products?campaign=slug). */
  async active(): Promise<CampaignView[]> {
    const now = new Date();
    const rows = await this.prisma.campaign.findMany({
      where: { isActive: true, startAt: { lte: now }, endAt: { gt: now } },
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { endAt: 'asc' }],
    });
    return rows.map((c) => toView(c, c._count.products));
  }

  async bySlug(slug: string): Promise<CampaignView> {
    const now = new Date();
    const c = await this.prisma.campaign.findFirst({
      where: { slug, isActive: true, startAt: { lte: now }, endAt: { gt: now } },
      include: { _count: { select: { products: true } } },
    });
    if (!c) throw new NotFoundException('This campaign has ended or does not exist');
    return toView(c, c._count.products);
  }

  // ───── Admin ─────

  async list(): Promise<CampaignView[]> {
    const rows = await this.prisma.campaign.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: [{ startAt: 'desc' }],
    });
    return rows.map((c) => toView(c, c._count.products));
  }

  async get(id: string): Promise<CampaignView & { productIds: string[] }> {
    const c = await this.prisma.campaign.findUnique({
      where: { id },
      include: { products: { orderBy: { sortOrder: 'asc' }, select: { productId: true } } },
    });
    if (!c) throw new NotFoundException('Campaign not found');
    return { ...toView(c, c.products.length), productIds: c.products.map((p) => p.productId) };
  }

  async create(input: CampaignPayload): Promise<CampaignView> {
    return toView(await this.prisma.campaign.create({ data: campaignData(input) }), 0);
  }

  async update(id: string, input: CampaignPayload): Promise<CampaignView> {
    const c = await this.prisma.campaign.update({
      where: { id },
      data: campaignData(input),
      include: { _count: { select: { products: true } } },
    });
    return toView(c, c._count.products);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.campaign.delete({ where: { id } });
  }

  async addProducts(id: string, productIds: string[]) {
    const max = await this.prisma.campaignProduct.aggregate({ where: { campaignId: id }, _max: { sortOrder: true } });
    const start = (max._max.sortOrder ?? -1) + 1;
    await this.prisma.campaignProduct.createMany({
      data: productIds.map((productId, i) => ({ campaignId: id, productId, sortOrder: start + i })),
      skipDuplicates: true,
    });
    return this.get(id);
  }

  async removeProducts(id: string, productIds: string[]) {
    await this.prisma.campaignProduct.deleteMany({ where: { campaignId: id, productId: { in: productIds } } });
    return this.get(id);
  }
}
