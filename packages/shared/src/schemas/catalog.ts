import { z } from 'zod';
import { ProductStatusSchema } from '../enums.js';
import { BooleanQuerySchema, MoneySchema, PaginationQuerySchema, SlugSchema, UrlSchema } from './common.js';

// ───────── Categories & brands ─────────

export const CategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  nameBn: z.string().trim().min(1).max(80),
  slug: SlugSchema,
  parentId: z.string().min(1).nullable().optional(),
  iconUrl: UrlSchema.nullable().optional(),
  imageUrl: UrlSchema.nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  /** Markdown buying guide / FAQ shown under the category's product grid. */
  seoContent: z.string().max(30_000).nullable().optional(),
});
export type CategoryInput = z.input<typeof CategorySchema>;
export type CategoryPayload = z.infer<typeof CategorySchema>;
export const UpdateCategorySchema = CategorySchema.partial();
export type UpdateCategoryInput = z.input<typeof UpdateCategorySchema>;
export type UpdateCategoryPayload = z.infer<typeof UpdateCategorySchema>;

export const BrandSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: SlugSchema,
  logoUrl: UrlSchema.nullable().optional(),
  isActive: z.boolean().default(true),
});
export type BrandInput = z.input<typeof BrandSchema>;
export type BrandPayload = z.infer<typeof BrandSchema>;
export const UpdateBrandSchema = BrandSchema.partial();
export type UpdateBrandInput = z.input<typeof UpdateBrandSchema>;
export type UpdateBrandPayload = z.infer<typeof UpdateBrandSchema>;

// ───────── Products ─────────

export const VariantAttributesSchema = z.record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(60));

export const VariantSchema = z
  .object({
    id: z.string().min(1).optional(),
    sku: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[A-Za-z0-9-_]+$/, 'SKU may contain letters, numbers, - and _'),
    attributes: VariantAttributesSchema.default({}),
    price: MoneySchema.min(100, 'Price must be at least ৳1'),
    compareAtPrice: MoneySchema.nullable().optional(),
    stock: z.coerce.number().int().min(0).max(1_000_000),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.compareAtPrice == null || v.compareAtPrice > v.price, {
    message: 'Compare-at price must be higher than price',
    path: ['compareAtPrice'],
  });
export type VariantInput = z.input<typeof VariantSchema>;
export type VariantPayload = z.infer<typeof VariantSchema>;

export const SpecificationSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(300),
});
export type Specification = z.infer<typeof SpecificationSchema>;

export const ProductImageInputSchema = z.object({
  url: UrlSchema,
  alt: z.string().trim().max(160).optional(),
});

export const ProductSchema = z.object({
  title: z.string().trim().min(5).max(200),
  titleBn: z.string().trim().max(200).optional(),
  slug: SlugSchema.optional(),
  description: z.string().trim().min(20).max(10_000),
  descriptionBn: z.string().trim().max(10_000).optional(),
  categoryId: z.string().min(1, 'Select a category'),
  brandId: z.string().min(1).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).default('ACTIVE'),
  /** Key features shown as bullets. */
  highlights: z.array(z.string().trim().min(2).max(200)).max(20).default([]),
  specifications: z.array(SpecificationSchema).max(60).default([]),
  warranty: z.string().trim().max(120).nullable().optional(),
  images: z.array(ProductImageInputSchema).min(1, 'Add at least one image').max(10),
  variants: z
    .array(VariantSchema)
    .min(1, 'Add at least one variant')
    .max(100)
    .refine((vs) => new Set(vs.map((v) => v.sku.toUpperCase())).size === vs.length, 'SKUs must be unique'),
});
export type ProductInput = z.input<typeof ProductSchema>;
export type ProductPayload = z.infer<typeof ProductSchema>;

export const UpdateProductSchema = ProductSchema.partial();
export type UpdateProductInput = z.input<typeof UpdateProductSchema>;
export type UpdateProductPayload = z.infer<typeof UpdateProductSchema>;

export const UpdateStockSchema = z.object({
  items: z.array(z.object({ variantId: z.string().min(1), stock: z.coerce.number().int().min(0) })).min(1).max(200),
});
export type UpdateStockInput = z.infer<typeof UpdateStockSchema>;

export const PRODUCT_SORTS = ['relevance', 'newest', 'popular', 'price_asc', 'price_desc', 'rating'] as const;
export const ProductSortSchema = z.enum(PRODUCT_SORTS);
export type ProductSort = z.infer<typeof ProductSortSchema>;

const CsvSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean));

export const ProductListQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  category: SlugSchema.optional(),
  brand: CsvSchema.optional(),
  seller: SlugSchema.optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  /** Attribute filters encoded as `color:Black,size:XL`. */
  attrs: CsvSchema.optional(),
  inStock: BooleanQuerySchema.optional(),
  campaign: SlugSchema.optional(),
  sort: ProductSortSchema.default('relevance'),
});
export type ProductListQuery = z.input<typeof ProductListQuerySchema>;
export type ProductListParams = z.infer<typeof ProductListQuerySchema>;

export const ManageProductListQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  status: ProductStatusSchema.optional(),
  sellerId: z.string().min(1).optional(),
  lowStock: BooleanQuerySchema.optional(),
});
export type ManageProductListQuery = z.input<typeof ManageProductListQuerySchema>;

export const SearchSuggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(10).default(8),
});
export type SearchSuggestQuery = z.input<typeof SearchSuggestQuerySchema>;
