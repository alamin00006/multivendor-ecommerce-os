import { z } from 'zod';
import { BannerPlacementSchema, CampaignTypeSchema, LinkTargetTypeSchema } from '../enums.js';
import { DateTimeSchema, MoneySchema, SlugSchema, UrlSchema } from './common.js';

const endAfterStart = (v: { startAt: Date; endAt: Date }) => v.endAt > v.startAt;
const endAfterStartError = {
  message: 'End must be after start',
  path: ['endAt'],
};

export const CampaignSchema = z
  .object({
    startAt: DateTimeSchema,
    endAt: DateTimeSchema,
    slug: SlugSchema,
    title: z.string().trim().min(3).max(120),
    titleBn: z.string().trim().max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    bannerUrl: UrlSchema,
    mobileBannerUrl: UrlSchema.nullable().optional(),
    themeColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    type: CampaignTypeSchema,
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .refine(endAfterStart, endAfterStartError);
export type CampaignInput = z.input<typeof CampaignSchema>;
export type CampaignPayload = z.infer<typeof CampaignSchema>;

export const CampaignProductsSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(500),
});
export type CampaignProductsInput = z.infer<typeof CampaignProductsSchema>;

export const FlashSaleItemSchema = z.object({
  variantId: z.string().min(1),
  specialPrice: MoneySchema.min(100),
  stockLimit: z.coerce.number().int().min(1).max(100_000),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
export type FlashSaleItemInput = z.input<typeof FlashSaleItemSchema>;
export type FlashSaleItemPayload = z.infer<typeof FlashSaleItemSchema>;

export const FlashSaleSchema = z
  .object({
    startAt: DateTimeSchema,
    endAt: DateTimeSchema,
    title: z.string().trim().min(3).max(120),
    titleBn: z.string().trim().max(120).optional(),
    isActive: z.boolean().default(true),
    items: z.array(FlashSaleItemSchema).max(200).default([]),
  })
  .refine(endAfterStart, endAfterStartError);
export type FlashSaleInput = z.input<typeof FlashSaleSchema>;
export type FlashSalePayload = z.infer<typeof FlashSaleSchema>;

export const BannerSchema = z.object({
  title: z.string().trim().min(2).max(120),
  imageUrl: UrlSchema,
  mobileImageUrl: UrlSchema.nullable().optional(),
  placement: BannerPlacementSchema.default('HOME_HERO'),
  linkType: LinkTargetTypeSchema,
  linkValue: z.string().trim().min(1).max(500),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  startAt: DateTimeSchema.nullable().optional(),
  endAt: DateTimeSchema.nullable().optional(),
});
export type BannerInput = z.input<typeof BannerSchema>;
export type BannerPayload = z.infer<typeof BannerSchema>;

export const QuickLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  labelBn: z.string().trim().min(1).max(40),
  iconUrl: UrlSchema,
  linkType: LinkTargetTypeSchema,
  linkValue: z.string().trim().min(1).max(500),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type QuickLinkInput = z.input<typeof QuickLinkSchema>;
export type QuickLinkPayload = z.infer<typeof QuickLinkSchema>;

export const BannerListQuerySchema = z.object({
  placement: BannerPlacementSchema.optional(),
});
