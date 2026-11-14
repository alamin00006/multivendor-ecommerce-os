import { z } from 'zod';
import { RoleSchema, SellerStatusSchema } from '../enums.js';
import { BdPhoneSchema, PaginationQuerySchema, SlugSchema, UrlSchema } from './common.js';

const OptionalUrl = z.union([UrlSchema, z.literal('')]).optional();

export const SocialLinksSchema = z.object({
  facebook: OptionalUrl,
  instagram: OptionalUrl,
  youtube: OptionalUrl,
  tiktok: OptionalUrl,
  linkedin: OptionalUrl,
});
export type SocialLinks = z.infer<typeof SocialLinksSchema>;

/** Every field is optional so the admin can save one section at a time. */
export const UpdatePlatformSettingsSchema = z
  .object({
    multiVendorEnabled: z.boolean(),
    shippingInsideDhaka: z.coerce.number().int().min(0).max(10_000_00),
    shippingOutsideDhaka: z.coerce.number().int().min(0).max(10_000_00),
    deliveryInsideDhaka: z.string().trim().min(1).max(40),
    deliveryOutsideDhaka: z.string().trim().min(1).max(40),
    returnDays: z.coerce.number().int().min(0).max(90),
    returnPolicy: z.string().trim().min(10).max(2000),
    storeAddress: z.string().trim().min(5).max(200),
    supportPhone: z.string().trim().min(5).max(30),
    supportEmail: z.string().trim().email().max(254),
    supportHours: z.string().trim().min(2).max(60),
    socialLinks: SocialLinksSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdatePlatformSettingsInput = z.input<typeof UpdatePlatformSettingsSchema>;
export type UpdatePlatformSettingsPayload = z.infer<typeof UpdatePlatformSettingsSchema>;

// ───────── Product Q&A ─────────

export const AskQuestionSchema = z.object({
  question: z.string().trim().min(5, 'Please write a little more').max(500),
});
export type AskQuestionInput = z.infer<typeof AskQuestionSchema>;

export const AnswerQuestionSchema = z.object({
  answer: z.string().trim().min(2).max(1000),
});
export type AnswerQuestionInput = z.infer<typeof AnswerQuestionSchema>;

export const ModerateQuestionSchema = z.object({ isVisible: z.boolean() });

export const QuestionListQuerySchema = PaginationQuerySchema.extend({
  unanswered: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
});
export type QuestionListQuery = z.input<typeof QuestionListQuerySchema>;

export const SellerRegisterSchema = z.object({
  shopName: z.string().trim().min(3).max(80),
  slug: SlugSchema.optional(),
  description: z.string().trim().max(1000).optional(),
  phone: BdPhoneSchema,
  pickupAddress: z.string().trim().min(5).max(255),
  logoUrl: UrlSchema.nullable().optional(),
});
export type SellerRegisterInput = z.infer<typeof SellerRegisterSchema>;

export const UpdateShopSchema = SellerRegisterSchema.partial().extend({ bannerUrl: UrlSchema.nullable().optional() });
export type UpdateShopInput = z.infer<typeof UpdateShopSchema>;

export const SellerAdminUpdateSchema = z.object({
  status: SellerStatusSchema.optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
});
export type SellerAdminUpdateInput = z.infer<typeof SellerAdminUpdateSchema>;

export const SellerListQuerySchema = PaginationQuerySchema.extend({
  status: SellerStatusSchema.optional(),
  q: z.string().trim().max(80).optional(),
});
export type SellerListQuery = z.input<typeof SellerListQuerySchema>;

export const UserListQuerySchema = PaginationQuerySchema.extend({
  role: RoleSchema.optional(),
  q: z.string().trim().max(80).optional(),
});
export type UserListQuery = z.input<typeof UserListQuerySchema>;

export const AdminUpdateUserSchema = z.object({
  isActive: z.boolean().optional(),
  role: RoleSchema.optional(),
});
export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;

export const NotificationListQuerySchema = PaginationQuerySchema.extend({
  unread: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
});
export type NotificationListQuery = z.input<typeof NotificationListQuerySchema>;

export const ImageResizeQuerySchema = z.object({
  url: z.string().url().max(2048),
  width: z.coerce.number().int().min(16).max(2400),
  quality: z.coerce.number().int().min(30).max(95).default(75),
  format: z.enum(['webp', 'avif', 'jpeg']).default('webp'),
});
export type ImageResizeQuery = z.input<typeof ImageResizeQuerySchema>;

export const UploadFolderSchema = z.object({
  folder: z.enum(['products', 'categories', 'brands', 'banners', 'campaigns', 'shops', 'reviews', 'avatars', 'returns']).default('products'),
});
export type UploadFolder = z.infer<typeof UploadFolderSchema>['folder'];
