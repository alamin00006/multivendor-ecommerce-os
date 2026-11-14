import { Injectable } from '@nestjs/common';
import type { PublicSettings, ShippingZone, UpdatePlatformSettingsPayload } from '@marketbd/shared';
import type { PlatformSetting, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const CACHE_TTL_MS = 30_000;
const SOCIAL_KEYS = ['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin'] as const;

const asSocial = (value: unknown): PublicSettings['store']['social'] => {
  const out: PublicSettings['store']['social'] = {};
  if (value && typeof value === 'object') {
    for (const key of SOCIAL_KEYS) {
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === 'string' && v) out[key] = v;
    }
  }
  return out;
};

export const toPublicSettings = (row: PlatformSetting): PublicSettings => ({
  multiVendorEnabled: row.multiVendorEnabled,
  shipping: {
    insideDhaka: row.shippingInsideDhaka,
    outsideDhaka: row.shippingOutsideDhaka,
    insideDhakaEta: row.deliveryInsideDhaka,
    outsideDhakaEta: row.deliveryOutsideDhaka,
  },
  returns: { days: row.returnDays, policy: row.returnPolicy },
  store: {
    address: row.storeAddress,
    phone: row.supportPhone,
    email: row.supportEmail,
    hours: row.supportHours,
    social: asSocial(row.socialLinks),
  },
});

/**
 * Store-wide settings editable in Admin → Settings (mode, delivery fees, returns, contact info).
 * Cached briefly; updates invalidate the cache immediately.
 */
@Injectable()
export class SettingsService {
  private cached: { row: PlatformSetting; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<PlatformSetting> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.row;
    // The row is created by the seed; upsert keeps a fresh database working too.
    const row = await this.prisma.platformSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    this.cached = { row, expiresAt: Date.now() + CACHE_TTL_MS };
    return row;
  }

  async publicSettings(): Promise<PublicSettings> {
    return toPublicSettings(await this.get());
  }

  /** Delivery fee (poisha) for a shipping zone. */
  async shippingFee(zone: ShippingZone | null): Promise<number> {
    const row = await this.get();
    return zone === 'INSIDE_DHAKA' ? row.shippingInsideDhaka : row.shippingOutsideDhaka;
  }

  async returnDays(): Promise<number> {
    return (await this.get()).returnDays;
  }

  async update(input: UpdatePlatformSettingsPayload, actorId: string): Promise<PublicSettings> {
    const { socialLinks, ...rest } = input;
    const data: Prisma.PlatformSettingUpdateInput = {
      ...rest,
      ...(socialLinks ? { socialLinks: Object.fromEntries(Object.entries(socialLinks).filter(([, v]) => v)) } : {}),
      updatedById: actorId,
    };
    const row = await this.prisma.platformSetting.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...(data as Prisma.PlatformSettingCreateInput) },
    });
    this.invalidate();
    return toPublicSettings(row);
  }

  invalidate(): void {
    this.cached = null;
  }
}
