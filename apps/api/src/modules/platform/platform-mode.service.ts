import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { SettingsService } from './settings.service.js';

interface SellerLike {
  id: string;
  shopName: string;
  slug: string;
  logoUrl: string | null;
  ratingAvg: { toNumber(): number } | number;
  isHouseStore: boolean;
}

/**
 * Single place that knows whether the platform runs as a multi-vendor marketplace.
 * Every mode-dependent decision in the API goes through this service.
 */
@Injectable()
export class PlatformModeService {
  constructor(private readonly settings: SettingsService) {}

  async isMultiVendor(): Promise<boolean> {
    return (await this.settings.get()).multiVendorEnabled;
  }

  async assertMultiVendor(): Promise<void> {
    if (!(await this.isMultiVendor())) {
      throw new ForbiddenException('Seller features are unavailable while the store runs in single-vendor mode');
    }
  }

  /** Seller filter for storefront-visible products in the current mode. */
  async visibleSellerWhere(): Promise<Prisma.SellerProfileWhereInput> {
    return (await this.isMultiVendor()) ? { status: 'APPROVED' } : { isHouseStore: true };
  }

  /** Full storefront visibility filter for products. */
  async visibleProductWhere(): Promise<Prisma.ProductWhereInput> {
    return { status: 'ACTIVE', seller: await this.visibleSellerWhere() };
  }

  /** Whether a product of this seller is visible on the storefront right now. */
  isSellerVisible(seller: { isHouseStore: boolean; status: string }, multiVendor: boolean): boolean {
    return multiVendor ? seller.status === 'APPROVED' : seller.isHouseStore;
  }

  /** Seller block for API responses — hidden (null) in single-vendor mode. */
  sellerView(seller: SellerLike, multiVendor: boolean) {
    if (!multiVendor) return null;
    return {
      id: seller.id,
      shopName: seller.shopName,
      slug: seller.slug,
      logoUrl: seller.logoUrl,
      ratingAvg: typeof seller.ratingAvg === 'number' ? seller.ratingAvg : seller.ratingAvg.toNumber(),
      isHouseStore: seller.isHouseStore,
    };
  }
}
