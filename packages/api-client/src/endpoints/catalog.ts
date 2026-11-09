import type {
  ApiResponse,
  BannerPlacement,
  BannerView,
  BrandView,
  CampaignView,
  CategoryNode,
  CategoryRef,
  CouponView,
  FlashSaleView,
  ProductCard,
  ProductDetail,
  ProductFacets,
  ProductListQuery,
  QuickLinkView,
  ReviewListQuery,
  ReviewSummary,
  ReviewView,
  SearchSuggestion,
  ShopView,
} from '@marketbd/shared';
import { baseApi, type Page, qs, unwrap, unwrapPage } from '../base-api.js';

export type CategoryDetail = CategoryNode & { breadcrumbs: CategoryRef[] };

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    categories: b.query<CategoryNode[], void>({
      query: () => '/categories',
      transformResponse: unwrap<CategoryNode[]>,
      providesTags: ['Categories'],
    }),
    category: b.query<CategoryDetail, string>({
      query: (slug) => `/categories/${slug}`,
      transformResponse: unwrap<CategoryDetail>,
      providesTags: ['Categories'],
    }),
    brands: b.query<BrandView[], void>({
      query: () => '/brands',
      transformResponse: unwrap<BrandView[]>,
      providesTags: ['Brands'],
    }),
    products: b.query<Page<ProductCard>, ProductListQuery>({
      query: (params) => `/products${qs(params)}`,
      transformResponse: unwrapPage<ProductCard>,
      providesTags: ['Products'],
    }),
    /** Infinite feed: pages are merged into one list while only `page` changes. */
    productFeed: b.query<Page<ProductCard>, ProductListQuery>({
      query: (params) => `/products${qs(params)}`,
      transformResponse: unwrapPage<ProductCard>,
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        const { page: _page, ...rest } = queryArgs;
        return `${endpointName}${qs(rest)}`;
      },
      merge: (cache, incoming, { arg }) => {
        if (Number(arg.page ?? 1) === 1) return incoming;
        const seen = new Set(cache.items.map((p) => p.id));
        cache.items.push(...incoming.items.filter((p) => !seen.has(p.id)));
        cache.meta = incoming.meta;
        return cache;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ['Products'],
    }),
    facets: b.query<ProductFacets, Omit<ProductListQuery, 'page' | 'limit' | 'sort'>>({
      query: (params) => `/products/facets${qs(params)}`,
      transformResponse: unwrap<ProductFacets>,
      providesTags: ['Products'],
    }),
    product: b.query<ProductDetail, string>({
      query: (slug) => `/products/${slug}`,
      transformResponse: unwrap<ProductDetail>,
      providesTags: (_r, _e, slug) => [{ type: 'Product', id: slug }, 'Product'],
    }),
    relatedProducts: b.query<ProductCard[], string>({
      query: (slug) => `/products/${slug}/related`,
      transformResponse: unwrap<ProductCard[]>,
      providesTags: ['Products'],
    }),
    searchSuggest: b.query<SearchSuggestion, string>({
      query: (q) => `/search/suggest${qs({ q })}`,
      transformResponse: unwrap<SearchSuggestion>,
      keepUnusedDataFor: 30,
    }),
    shop: b.query<ShopView, string>({
      query: (slug) => `/shops/${slug}`,
      transformResponse: unwrap<ShopView>,
      providesTags: ['Products'],
    }),
    productReviews: b.query<Page<ReviewView>, { productId: string } & ReviewListQuery>({
      query: ({ productId, ...params }) => `/products/${productId}/reviews${qs(params)}`,
      transformResponse: unwrapPage<ReviewView>,
      providesTags: ['Reviews'],
    }),
    reviewSummary: b.query<ReviewSummary, string>({
      query: (productId) => `/products/${productId}/reviews/summary`,
      transformResponse: unwrap<ReviewSummary>,
      providesTags: ['Reviews'],
    }),
    banners: b.query<BannerView[], BannerPlacement | void>({
      query: (placement) => `/banners${qs({ placement: placement ?? undefined })}`,
      transformResponse: unwrap<BannerView[]>,
      providesTags: ['Banners'],
    }),
    quickLinks: b.query<QuickLinkView[], void>({
      query: () => '/quick-links',
      transformResponse: unwrap<QuickLinkView[]>,
      providesTags: ['QuickLinks'],
    }),
    activeFlashSale: b.query<FlashSaleView | null, void>({
      query: () => '/flash-sales/active',
      transformResponse: (r: ApiResponse<FlashSaleView | null>) => r.data,
      providesTags: ['FlashSale'],
    }),
    campaigns: b.query<CampaignView[], void>({
      query: () => '/campaigns',
      transformResponse: unwrap<CampaignView[]>,
      providesTags: ['Campaigns'],
    }),
    campaign: b.query<CampaignView, string>({
      query: (slug) => `/campaigns/${slug}`,
      transformResponse: unwrap<CampaignView>,
      providesTags: ['Campaigns'],
    }),
    availableCoupons: b.query<CouponView[], void>({
      query: () => '/coupons/available',
      transformResponse: unwrap<CouponView[]>,
      providesTags: ['Coupons'],
    }),
  }),
});

export const {
  useCategoriesQuery,
  useCategoryQuery,
  useBrandsQuery,
  useProductsQuery,
  useProductFeedQuery,
  useFacetsQuery,
  useProductQuery,
  useRelatedProductsQuery,
  useSearchSuggestQuery,
  useShopQuery,
  useProductReviewsQuery,
  useReviewSummaryQuery,
  useBannersQuery,
  useQuickLinksQuery,
  useActiveFlashSaleQuery,
  useCampaignsQuery,
  useCampaignQuery,
  useAvailableCouponsQuery,
} = catalogApi;
