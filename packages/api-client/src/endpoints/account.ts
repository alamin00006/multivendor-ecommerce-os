import type {
  AddressInput,
  AddressView,
  AddToCartInput,
  ApiResponse,
  AreaOption,
  CancelOrderInput,
  CartView,
  CheckoutInput,
  CheckoutPreview,
  CheckoutPreviewInput,
  GeoOption,
  InitiatePaymentInput,
  MergeCartInput,
  NotificationListQuery,
  NotificationView,
  OrderDetail,
  OrderListQuery,
  OrderSummary,
  PaymentInitResult,
  PaymentMethod,
  PlaceOrderResult,
  ReturnRequestInput,
  ReviewInput,
  ReviewView,
  SellerProfileView,
  SellerRegisterInput,
  UpdateAddressInput,
  UpdateCartItemInput,
  UploadFolder,
  UploadResult,
  WishlistItemView,
} from '@marketbd/shared';
import { baseApi, type Page, qs, unwrap, unwrapPage } from '../base-api.js';

export const accountApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    // ───── Geo & addresses ─────
    divisions: b.query<GeoOption[], void>({
      query: () => '/geo/divisions',
      transformResponse: unwrap<GeoOption[]>,
      keepUnusedDataFor: 3600,
    }),
    districts: b.query<GeoOption[], number>({
      query: (divisionId) => `/geo/divisions/${divisionId}/districts`,
      transformResponse: unwrap<GeoOption[]>,
      keepUnusedDataFor: 3600,
    }),
    areas: b.query<AreaOption[], number>({
      query: (districtId) => `/geo/districts/${districtId}/areas`,
      transformResponse: unwrap<AreaOption[]>,
      keepUnusedDataFor: 3600,
    }),
    addresses: b.query<AddressView[], void>({
      query: () => '/addresses',
      transformResponse: unwrap<AddressView[]>,
      providesTags: ['Addresses'],
    }),
    createAddress: b.mutation<AddressView, AddressInput>({
      query: (body) => ({ url: '/addresses', method: 'POST', body }),
      transformResponse: unwrap<AddressView>,
      invalidatesTags: ['Addresses'],
    }),
    updateAddress: b.mutation<AddressView, { id: string } & UpdateAddressInput>({
      query: ({ id, ...body }) => ({ url: `/addresses/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<AddressView>,
      invalidatesTags: ['Addresses'],
    }),
    deleteAddress: b.mutation<null, string>({
      query: (id) => ({ url: `/addresses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Addresses'],
    }),

    // ───── Cart ─────
    cart: b.query<CartView, void>({
      query: () => '/cart',
      transformResponse: unwrap<CartView>,
      providesTags: ['Cart'],
    }),
    addToCart: b.mutation<CartView, AddToCartInput>({
      query: (body) => ({ url: '/cart/items', method: 'POST', body }),
      transformResponse: unwrap<CartView>,
      invalidatesTags: ['Cart'],
    }),
    updateCartItem: b.mutation<CartView, { id: string } & UpdateCartItemInput>({
      query: ({ id, ...body }) => ({ url: `/cart/items/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<CartView>,
      invalidatesTags: ['Cart'],
    }),
    removeCartItem: b.mutation<CartView, string>({
      query: (id) => ({ url: `/cart/items/${id}`, method: 'DELETE' }),
      transformResponse: unwrap<CartView>,
      invalidatesTags: ['Cart'],
    }),
    selectAllCart: b.mutation<CartView, boolean>({
      query: (selected) => ({ url: '/cart/select-all', method: 'POST', body: { selected } }),
      transformResponse: unwrap<CartView>,
      invalidatesTags: ['Cart'],
    }),
    clearUnavailable: b.mutation<CartView, void>({
      query: () => ({ url: '/cart/clear-unavailable', method: 'POST' }),
      transformResponse: unwrap<CartView>,
      invalidatesTags: ['Cart'],
    }),
    mergeCart: b.mutation<CartView, MergeCartInput>({
      query: (body) => ({ url: '/cart/merge', method: 'POST', body }),
      transformResponse: unwrap<CartView>,
      invalidatesTags: ['Cart'],
    }),

    // ───── Wishlist ─────
    wishlist: b.query<WishlistItemView[], void>({
      query: () => '/wishlist',
      transformResponse: unwrap<WishlistItemView[]>,
      providesTags: ['Wishlist'],
    }),
    wishlistIds: b.query<string[], void>({
      query: () => '/wishlist/ids',
      transformResponse: unwrap<string[]>,
      providesTags: ['Wishlist'],
    }),
    addToWishlist: b.mutation<string[], string>({
      query: (productId) => ({ url: `/wishlist/${productId}`, method: 'POST' }),
      transformResponse: unwrap<string[]>,
      invalidatesTags: ['Wishlist'],
    }),
    removeFromWishlist: b.mutation<string[], string>({
      query: (productId) => ({ url: `/wishlist/${productId}`, method: 'DELETE' }),
      transformResponse: unwrap<string[]>,
      invalidatesTags: ['Wishlist'],
    }),

    // ───── Checkout & orders ─────
    paymentMethods: b.query<Array<{ method: PaymentMethod; enabled: boolean }>, void>({
      query: () => '/payments/methods',
      transformResponse: unwrap<Array<{ method: PaymentMethod; enabled: boolean }>>,
    }),
    checkoutPreview: b.query<CheckoutPreview, CheckoutPreviewInput>({
      query: (body) => ({ url: '/checkout/preview', method: 'POST', body }),
      transformResponse: unwrap<CheckoutPreview>,
      providesTags: ['Cart'],
    }),
    placeOrder: b.mutation<PlaceOrderResult, CheckoutInput>({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      transformResponse: unwrap<PlaceOrderResult>,
      invalidatesTags: ['Cart', 'Orders', 'Products', 'FlashSale', 'Notifications'],
    }),
    initiatePayment: b.mutation<PaymentInitResult, InitiatePaymentInput>({
      query: (body) => ({ url: '/payments/initiate', method: 'POST', body }),
      transformResponse: unwrap<PaymentInitResult>,
      invalidatesTags: ['Orders'],
    }),
    orders: b.query<Page<OrderSummary>, OrderListQuery>({
      query: (params) => `/orders${qs(params)}`,
      transformResponse: unwrapPage<OrderSummary>,
      providesTags: ['Orders'],
    }),
    order: b.query<OrderDetail, string>({
      query: (id) => `/orders/${id}`,
      transformResponse: unwrap<OrderDetail>,
      providesTags: (_r, _e, id) => [{ type: 'Orders', id }],
    }),
    cancelOrder: b.mutation<OrderDetail, { id: string } & CancelOrderInput>({
      query: ({ id, ...body }) => ({ url: `/orders/${id}/cancel`, method: 'POST', body }),
      transformResponse: unwrap<OrderDetail>,
      invalidatesTags: ['Orders', 'Products'],
    }),
    requestReturn: b.mutation<OrderDetail, { id: string } & ReturnRequestInput>({
      query: ({ id, ...body }) => ({ url: `/orders/${id}/returns`, method: 'POST', body }),
      transformResponse: unwrap<OrderDetail>,
      invalidatesTags: ['Orders'],
    }),
    createReview: b.mutation<ReviewView, ReviewInput>({
      query: (body) => ({ url: '/reviews', method: 'POST', body }),
      transformResponse: unwrap<ReviewView>,
      invalidatesTags: ['Reviews', 'Orders', 'Product'],
    }),

    // ───── Notifications ─────
    notifications: b.query<Page<NotificationView>, NotificationListQuery>({
      query: (params) => `/notifications${qs(params)}`,
      transformResponse: unwrapPage<NotificationView>,
      providesTags: ['Notifications'],
    }),
    unreadCount: b.query<{ count: number }, void>({
      query: () => '/notifications/unread-count',
      transformResponse: unwrap<{ count: number }>,
      providesTags: ['Notifications'],
    }),
    markNotificationRead: b.mutation<null, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),
    markAllNotificationsRead: b.mutation<null, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: ['Notifications'],
    }),

    // ───── Uploads ─────
    uploadImage: b.mutation<UploadResult, { folder: UploadFolder; file: FormData }>({
      query: ({ folder, file }) => ({ url: `/uploads/image${qs({ folder })}`, method: 'POST', body: file }),
      transformResponse: unwrap<UploadResult>,
    }),

    // ───── Become a seller ─────
    registerSeller: b.mutation<SellerProfileView, SellerRegisterInput>({
      query: (body) => ({ url: '/sellers/register', method: 'POST', body }),
      transformResponse: unwrap<SellerProfileView>,
      invalidatesTags: ['SellerProfile', 'Me'],
    }),
    mySellerProfile: b.query<SellerProfileView | null, void>({
      query: () => '/sellers/me',
      transformResponse: (r: ApiResponse<SellerProfileView | null>) => r.data,
      providesTags: ['SellerProfile'],
    }),
  }),
});

export const {
  useDivisionsQuery,
  useDistrictsQuery,
  useAreasQuery,
  useAddressesQuery,
  useCreateAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useCartQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
  useSelectAllCartMutation,
  useClearUnavailableMutation,
  useMergeCartMutation,
  useWishlistQuery,
  useWishlistIdsQuery,
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation,
  usePaymentMethodsQuery,
  useCheckoutPreviewQuery,
  usePlaceOrderMutation,
  useInitiatePaymentMutation,
  useOrdersQuery,
  useOrderQuery,
  useCancelOrderMutation,
  useRequestReturnMutation,
  useCreateReviewMutation,
  useNotificationsQuery,
  useUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useUploadImageMutation,
  useRegisterSellerMutation,
  useMySellerProfileQuery,
} = accountApi;
