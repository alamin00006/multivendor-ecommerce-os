import { z } from 'zod';
import { RoleSchema, SellerStatusSchema } from '../enums.js';
import { BdPhoneSchema, PaginationQuerySchema, SlugSchema, UrlSchema } from './common.js';

export const UpdatePlatformSettingsSchema = z.object({ multiVendorEnabled: z.boolean() });
export type UpdatePlatformSettingsInput = z.infer<typeof UpdatePlatformSettingsSchema>;

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
