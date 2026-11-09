import { Injectable } from '@nestjs/common';
import type { BannerPayload, BannerPlacement, BannerView, QuickLinkPayload, QuickLinkView } from '@marketbd/shared';
import type { Banner, QuickLink } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const toBanner = (b: Banner): BannerView => ({
  id: b.id,
  title: b.title,
  imageUrl: b.imageUrl,
  mobileImageUrl: b.mobileImageUrl,
  placement: b.placement,
  linkType: b.linkType,
  linkValue: b.linkValue,
  sortOrder: b.sortOrder,
  isActive: b.isActive,
  startAt: b.startAt?.toISOString() ?? null,
  endAt: b.endAt?.toISOString() ?? null,
});

const toQuickLink = (q: QuickLink): QuickLinkView => ({
  id: q.id,
  label: q.label,
  labelBn: q.labelBn,
  iconUrl: q.iconUrl,
  linkType: q.linkType,
  linkValue: q.linkValue,
  sortOrder: q.sortOrder,
  isActive: q.isActive,
});

const bannerData = (i: BannerPayload) => ({
  title: i.title,
  imageUrl: i.imageUrl,
  mobileImageUrl: i.mobileImageUrl ?? null,
  placement: i.placement ?? 'HOME_HERO',
  linkType: i.linkType,
  linkValue: i.linkValue,
  sortOrder: Number(i.sortOrder ?? 0),
  isActive: i.isActive ?? true,
  startAt: i.startAt ? new Date(i.startAt as Date) : null,
  endAt: i.endAt ? new Date(i.endAt as Date) : null,
});

const quickLinkData = (i: QuickLinkPayload) => ({
  label: i.label,
  labelBn: i.labelBn,
  iconUrl: i.iconUrl,
  linkType: i.linkType,
  linkValue: i.linkValue,
  sortOrder: Number(i.sortOrder ?? 0),
  isActive: i.isActive ?? true,
});

@Injectable()
export class MerchandisingService {
  constructor(private readonly prisma: PrismaService) {}

  async banners(placement?: BannerPlacement): Promise<BannerView[]> {
    const now = new Date();
    const rows = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        ...(placement ? { placement } : {}),
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gt: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toBanner);
  }

  async quickLinks(): Promise<QuickLinkView[]> {
    return (await this.prisma.quickLink.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })).map(
      toQuickLink,
    );
  }

  // ───── Admin ─────

  async allBanners(): Promise<BannerView[]> {
    return (await this.prisma.banner.findMany({ orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] })).map(toBanner);
  }

  async createBanner(input: BannerPayload) {
    return toBanner(await this.prisma.banner.create({ data: bannerData(input) }));
  }

  async updateBanner(id: string, input: BannerPayload) {
    return toBanner(await this.prisma.banner.update({ where: { id }, data: bannerData(input) }));
  }

  async removeBanner(id: string) {
    await this.prisma.banner.delete({ where: { id } });
  }

  async allQuickLinks(): Promise<QuickLinkView[]> {
    return (await this.prisma.quickLink.findMany({ orderBy: { sortOrder: 'asc' } })).map(toQuickLink);
  }

  async createQuickLink(input: QuickLinkPayload) {
    return toQuickLink(await this.prisma.quickLink.create({ data: quickLinkData(input) }));
  }

  async updateQuickLink(id: string, input: QuickLinkPayload) {
    return toQuickLink(await this.prisma.quickLink.update({ where: { id }, data: quickLinkData(input) }));
  }

  async removeQuickLink(id: string) {
    await this.prisma.quickLink.delete({ where: { id } });
  }
}
