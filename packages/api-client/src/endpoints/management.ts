import type {
  AdminDashboard,
  AdminUpdateUserInput,
  AdminUserView,
  BannerInput,
  BannerView,
  BrandInput,
  BrandView,
  CampaignInput,
  CampaignView,
  CategoryInput,
  CategoryNode,
  CouponInput,
  CouponView,
  FlashSaleInput,
  FlashSaleView,
  ManagedProduct,
  ManageProductListQuery,
  OrderDetail,
  OrderListQuery,
  OrderSummary,
  ProductInput,
  ProductStatus,
  QuickLinkInput,
  QuickLinkView,
  RefundInput,
  ReturnStatus,
  ReviewView,
  SellerAdminUpdateInput,
  SellerDashboard,
  SellerListQuery,
  SellerOrderView,
  SellerProfileView,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdateOrderStatusInput,
  UpdateProductInput,
  UpdateReturnInput,
  UpdateShopInput,
  UpdateStockInput,
  UserListQuery,
} from '@marketbd/shared';
import { baseApi, type Page, qs, unwrap, unwrapPage } from '../base-api.js';

export interface AdminReturnRow {
  id: string;
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  subOrderId: string | null;
  reason: string;
  imageUrls: string[];
  status: ReturnStatus;
  adminNote: string | null;
  createdAt: string;
}

/** Product CRUD is identical for sellers (/seller/products) and admins (/admin/products). */
type Scope = 'seller' | 'admin';
const productTag = (scope: Scope): 'SellerProducts' | 'AdminProducts' =>
  scope === 'seller' ? 'SellerProducts' : 'AdminProducts';

export const managementApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    // ───── Shared product management ─────
    managedProducts: b.query<Page<ManagedProduct>, { scope: Scope } & ManageProductListQuery>({
      query: ({ scope, ...params }) => `/${scope}/products${qs(params)}`,
      transformResponse: unwrapPage<ManagedProduct>,
      providesTags: (_r, _e, { scope }) => [productTag(scope)],
    }),
    managedProduct: b.query<ManagedProduct, { scope: Scope; id: string }>({
      query: ({ scope, id }) => `/${scope}/products/${id}`,
      transformResponse: unwrap<ManagedProduct>,
      providesTags: (_r, _e, { scope }) => [productTag(scope)],
    }),
    createManagedProduct: b.mutation<ManagedProduct, { scope: Scope; body: ProductInput }>({
      query: ({ scope, body }) => ({ url: `/${scope}/products`, method: 'POST', body }),
      transformResponse: unwrap<ManagedProduct>,
      invalidatesTags: (_r, _e, { scope }) => [productTag(scope), 'Products', 'SellerDashboard'],
    }),
    updateManagedProduct: b.mutation<ManagedProduct, { scope: Scope; id: string; body: UpdateProductInput }>({
      query: ({ scope, id, body }) => ({ url: `/${scope}/products/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<ManagedProduct>,
      invalidatesTags: (_r, _e, { scope }) => [productTag(scope), 'Products', 'Product', 'SellerDashboard'],
    }),
    deleteManagedProduct: b.mutation<{ deleted: boolean }, { scope: Scope; id: string }>({
      query: ({ scope, id }) => ({ url: `/${scope}/products/${id}`, method: 'DELETE' }),
      transformResponse: unwrap<{ deleted: boolean }>,
      invalidatesTags: (_r, _e, { scope }) => [productTag(scope), 'Products', 'SellerDashboard'],
    }),
    updateStock: b.mutation<null, { scope: Scope; body: UpdateStockInput }>({
      query: ({ scope, body }) => ({ url: `/${scope}/products/stock`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { scope }) => [productTag(scope), 'Products', 'Product', 'SellerDashboard'],
    }),
    setProductStatus: b.mutation<ManagedProduct, { id: string; status: ProductStatus }>({
      query: ({ id, status }) => ({ url: `/admin/products/${id}/status`, method: 'PATCH', body: { status } }),
      transformResponse: unwrap<ManagedProduct>,
      invalidatesTags: ['AdminProducts', 'Products', 'Product'],
    }),

    // ───── Seller panel ─────
    sellerDashboard: b.query<SellerDashboard, void>({
      query: () => '/seller/dashboard',
      transformResponse: unwrap<SellerDashboard>,
      providesTags: ['SellerDashboard'],
    }),
    updateShop: b.mutation<SellerProfileView, UpdateShopInput>({
      query: (body) => ({ url: '/sellers/me', method: 'PATCH', body }),
      transformResponse: unwrap<SellerProfileView>,
      invalidatesTags: ['SellerProfile'],
    }),
    sellerOrders: b.query<Page<SellerOrderView>, OrderListQuery>({
      query: (params) => `/seller/orders${qs(params)}`,
      transformResponse: unwrapPage<SellerOrderView>,
      providesTags: ['SellerOrders'],
    }),
    sellerOrder: b.query<SellerOrderView, string>({
      query: (id) => `/seller/orders/${id}`,
      transformResponse: unwrap<SellerOrderView>,
      providesTags: ['SellerOrders'],
    }),
    updateSellerOrder: b.mutation<SellerOrderView, { id: string } & UpdateOrderStatusInput>({
      query: ({ id, ...body }) => ({ url: `/seller/orders/${id}/status`, method: 'PATCH', body }),
      transformResponse: unwrap<SellerOrderView>,
      invalidatesTags: ['SellerOrders', 'SellerDashboard'],
    }),

    // ───── Admin ─────
    adminDashboard: b.query<AdminDashboard, void>({
      query: () => '/admin/dashboard',
      transformResponse: unwrap<AdminDashboard>,
      providesTags: ['AdminDashboard'],
    }),
    adminUsers: b.query<Page<AdminUserView>, UserListQuery>({
      query: (params) => `/admin/users${qs(params)}`,
      transformResponse: unwrapPage<AdminUserView>,
      providesTags: ['AdminUsers'],
    }),
    adminUpdateUser: b.mutation<AdminUserView, { id: string } & AdminUpdateUserInput>({
      query: ({ id, ...body }) => ({ url: `/admin/users/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<AdminUserView>,
      invalidatesTags: ['AdminUsers'],
    }),
    adminSellers: b.query<Page<SellerProfileView>, SellerListQuery>({
      query: (params) => `/admin/sellers${qs(params)}`,
      transformResponse: unwrapPage<SellerProfileView>,
      providesTags: ['AdminSellers'],
    }),
    adminUpdateSeller: b.mutation<SellerProfileView, { id: string } & SellerAdminUpdateInput>({
      query: ({ id, ...body }) => ({ url: `/admin/sellers/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<SellerProfileView>,
      invalidatesTags: ['AdminSellers', 'AdminDashboard', 'Products'],
    }),
    adminCategories: b.query<CategoryNode[], void>({
      query: () => '/admin/categories',
      transformResponse: unwrap<CategoryNode[]>,
      providesTags: ['AdminCategories'],
    }),
    adminCreateCategory: b.mutation<CategoryNode, CategoryInput>({
      query: (body) => ({ url: '/admin/categories', method: 'POST', body }),
      transformResponse: unwrap<CategoryNode>,
      invalidatesTags: ['AdminCategories', 'Categories'],
    }),
    adminUpdateCategory: b.mutation<CategoryNode, { id: string } & UpdateCategoryInput>({
      query: ({ id, ...body }) => ({ url: `/admin/categories/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<CategoryNode>,
      invalidatesTags: ['AdminCategories', 'Categories'],
    }),
    adminDeleteCategory: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminCategories', 'Categories'],
    }),
    adminBrands: b.query<BrandView[], void>({
      query: () => '/admin/brands',
      transformResponse: unwrap<BrandView[]>,
      providesTags: ['AdminBrands'],
    }),
    adminCreateBrand: b.mutation<BrandView, BrandInput>({
      query: (body) => ({ url: '/admin/brands', method: 'POST', body }),
      transformResponse: unwrap<BrandView>,
      invalidatesTags: ['AdminBrands', 'Brands'],
    }),
    adminUpdateBrand: b.mutation<BrandView, { id: string } & UpdateBrandInput>({
      query: ({ id, ...body }) => ({ url: `/admin/brands/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<BrandView>,
      invalidatesTags: ['AdminBrands', 'Brands'],
    }),
    adminDeleteBrand: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/brands/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminBrands', 'Brands'],
    }),
    adminBanners: b.query<BannerView[], void>({
      query: () => '/admin/banners',
      transformResponse: unwrap<BannerView[]>,
      providesTags: ['AdminBanners'],
    }),
    adminSaveBanner: b.mutation<BannerView, { id?: string; body: BannerInput }>({
      query: ({ id, body }) => ({ url: id ? `/admin/banners/${id}` : '/admin/banners', method: id ? 'PATCH' : 'POST', body }),
      transformResponse: unwrap<BannerView>,
      invalidatesTags: ['AdminBanners', 'Banners'],
    }),
    adminDeleteBanner: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/banners/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminBanners', 'Banners'],
    }),
    adminQuickLinks: b.query<QuickLinkView[], void>({
      query: () => '/admin/quick-links',
      transformResponse: unwrap<QuickLinkView[]>,
      providesTags: ['AdminQuickLinks'],
    }),
    adminSaveQuickLink: b.mutation<QuickLinkView, { id?: string; body: QuickLinkInput }>({
      query: ({ id, body }) => ({
        url: id ? `/admin/quick-links/${id}` : '/admin/quick-links',
        method: id ? 'PATCH' : 'POST',
        body,
      }),
      transformResponse: unwrap<QuickLinkView>,
      invalidatesTags: ['AdminQuickLinks', 'QuickLinks'],
    }),
    adminDeleteQuickLink: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/quick-links/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminQuickLinks', 'QuickLinks'],
    }),
    adminCampaigns: b.query<CampaignView[], void>({
      query: () => '/admin/campaigns',
      transformResponse: unwrap<CampaignView[]>,
      providesTags: ['AdminCampaigns'],
    }),
    adminCampaign: b.query<CampaignView & { productIds: string[] }, string>({
      query: (id) => `/admin/campaigns/${id}`,
      transformResponse: unwrap<CampaignView & { productIds: string[] }>,
      providesTags: ['AdminCampaigns'],
    }),
    adminSaveCampaign: b.mutation<CampaignView, { id?: string; body: CampaignInput }>({
      query: ({ id, body }) => ({ url: id ? `/admin/campaigns/${id}` : '/admin/campaigns', method: id ? 'PATCH' : 'POST', body }),
      transformResponse: unwrap<CampaignView>,
      invalidatesTags: ['AdminCampaigns', 'Campaigns'],
    }),
    adminDeleteCampaign: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/campaigns/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminCampaigns', 'Campaigns'],
    }),
    adminCampaignProducts: b.mutation<CampaignView, { id: string; productIds: string[]; remove?: boolean }>({
      query: ({ id, productIds, remove }) => ({
        url: `/admin/campaigns/${id}/products${remove ? '/remove' : ''}`,
        method: 'POST',
        body: { productIds },
      }),
      transformResponse: unwrap<CampaignView>,
      invalidatesTags: ['AdminCampaigns', 'Campaigns', 'Products'],
    }),
    adminFlashSales: b.query<FlashSaleView[], void>({
      query: () => '/admin/flash-sales',
      transformResponse: unwrap<FlashSaleView[]>,
      providesTags: ['AdminFlashSales'],
    }),
    adminSaveFlashSale: b.mutation<FlashSaleView, { id?: string; body: FlashSaleInput }>({
      query: ({ id, body }) => ({
        url: id ? `/admin/flash-sales/${id}` : '/admin/flash-sales',
        method: id ? 'PATCH' : 'POST',
        body,
      }),
      transformResponse: unwrap<FlashSaleView>,
      invalidatesTags: ['AdminFlashSales', 'FlashSale', 'Products'],
    }),
    adminDeleteFlashSale: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/flash-sales/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminFlashSales', 'FlashSale', 'Products'],
    }),
    adminCoupons: b.query<CouponView[], void>({
      query: () => '/admin/coupons',
      transformResponse: unwrap<CouponView[]>,
      providesTags: ['AdminCoupons'],
    }),
    adminSaveCoupon: b.mutation<CouponView, { id?: string; body: CouponInput }>({
      query: ({ id, body }) => ({ url: id ? `/admin/coupons/${id}` : '/admin/coupons', method: id ? 'PATCH' : 'POST', body }),
      transformResponse: unwrap<CouponView>,
      invalidatesTags: ['AdminCoupons', 'Coupons'],
    }),
    adminDeleteCoupon: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/coupons/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminCoupons', 'Coupons'],
    }),
    adminOrders: b.query<Page<OrderSummary>, OrderListQuery>({
      query: (params) => `/admin/orders${qs(params)}`,
      transformResponse: unwrapPage<OrderSummary>,
      providesTags: ['AdminOrders'],
    }),
    adminOrder: b.query<OrderDetail, string>({
      query: (id) => `/admin/orders/${id}`,
      transformResponse: unwrap<OrderDetail>,
      providesTags: ['AdminOrders'],
    }),
    adminSetOrderStatus: b.mutation<OrderDetail, { id: string; subOrderId?: string } & UpdateOrderStatusInput>({
      query: ({ id, subOrderId, ...body }) => ({
        url: subOrderId ? `/admin/orders/${id}/sub-orders/${subOrderId}/status` : `/admin/orders/${id}/status`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap<OrderDetail>,
      invalidatesTags: ['AdminOrders', 'AdminDashboard'],
    }),
    adminRefund: b.mutation<OrderDetail, { id: string } & RefundInput>({
      query: ({ id, ...body }) => ({ url: `/admin/orders/${id}/refunds`, method: 'POST', body }),
      transformResponse: unwrap<OrderDetail>,
      invalidatesTags: ['AdminOrders', 'AdminDashboard', 'AdminReturns'],
    }),
    adminReturns: b.query<Page<AdminReturnRow>, { page?: number; limit?: number; status?: ReturnStatus }>({
      query: (params) => `/admin/returns${qs(params)}`,
      transformResponse: unwrapPage<AdminReturnRow>,
      providesTags: ['AdminReturns'],
    }),
    adminUpdateReturn: b.mutation<OrderDetail, { id: string } & UpdateReturnInput>({
      query: ({ id, ...body }) => ({ url: `/admin/returns/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<OrderDetail>,
      invalidatesTags: ['AdminReturns', 'AdminOrders'],
    }),
    adminReviews: b.query<Page<ReviewView>, { page?: number; limit?: number }>({
      query: (params) => `/admin/reviews${qs(params)}`,
      transformResponse: unwrapPage<ReviewView>,
      providesTags: ['AdminReviews'],
    }),
    adminModerateReview: b.mutation<ReviewView, { id: string; isVisible: boolean }>({
      query: ({ id, isVisible }) => ({ url: `/admin/reviews/${id}`, method: 'PATCH', body: { isVisible } }),
      transformResponse: unwrap<ReviewView>,
      invalidatesTags: ['AdminReviews', 'Reviews'],
    }),
  }),
});

export const {
  useManagedProductsQuery,
  useManagedProductQuery,
  useCreateManagedProductMutation,
  useUpdateManagedProductMutation,
  useDeleteManagedProductMutation,
  useUpdateStockMutation,
  useSetProductStatusMutation,
  useSellerDashboardQuery,
  useUpdateShopMutation,
  useSellerOrdersQuery,
  useSellerOrderQuery,
  useUpdateSellerOrderMutation,
  useAdminDashboardQuery,
  useAdminUsersQuery,
  useAdminUpdateUserMutation,
  useAdminSellersQuery,
  useAdminUpdateSellerMutation,
  useAdminCategoriesQuery,
  useAdminCreateCategoryMutation,
  useAdminUpdateCategoryMutation,
  useAdminDeleteCategoryMutation,
  useAdminBrandsQuery,
  useAdminCreateBrandMutation,
  useAdminUpdateBrandMutation,
  useAdminDeleteBrandMutation,
  useAdminBannersQuery,
  useAdminSaveBannerMutation,
  useAdminDeleteBannerMutation,
  useAdminQuickLinksQuery,
  useAdminSaveQuickLinkMutation,
  useAdminDeleteQuickLinkMutation,
  useAdminCampaignsQuery,
  useAdminCampaignQuery,
  useAdminSaveCampaignMutation,
  useAdminDeleteCampaignMutation,
  useAdminCampaignProductsMutation,
  useAdminFlashSalesQuery,
  useAdminSaveFlashSaleMutation,
  useAdminDeleteFlashSaleMutation,
  useAdminCouponsQuery,
  useAdminSaveCouponMutation,
  useAdminDeleteCouponMutation,
  useAdminOrdersQuery,
  useAdminOrderQuery,
  useAdminSetOrderStatusMutation,
  useAdminRefundMutation,
  useAdminReturnsQuery,
  useAdminUpdateReturnMutation,
  useAdminReviewsQuery,
  useAdminModerateReviewMutation,
} = managementApi;
