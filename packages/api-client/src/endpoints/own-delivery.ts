import type {
  DeliveryDisputeInput,
  OpenDisputeView,
  OwnDeliveryDecisionInput,
  OwnDeliveryInput,
  OwnDeliveryShopView,
  OwnDeliveryView,
  ResolveDisputeInput,
  SellerAdjustmentInput,
  SellerAdjustmentView,
} from '@marketbd/shared';
import { baseApi, qs, unwrap } from '../base-api.js';

/** Shops delivering with their own courier, their dues, and "not received" complaints. */
export const ownDeliveryApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    // Seller
    ownDelivery: b.query<OwnDeliveryView, void>({
      query: () => '/seller/own-delivery',
      transformResponse: unwrap<OwnDeliveryView>,
      providesTags: ['OwnDelivery'],
    }),
    saveOwnDelivery: b.mutation<OwnDeliveryView, OwnDeliveryInput>({
      query: (body) => ({ url: '/seller/own-delivery', method: 'PUT', body }),
      transformResponse: unwrap<OwnDeliveryView>,
      invalidatesTags: ['OwnDelivery'],
    }),
    stopOwnDelivery: b.mutation<OwnDeliveryView, void>({
      query: () => ({ url: '/seller/own-delivery', method: 'DELETE' }),
      transformResponse: unwrap<OwnDeliveryView>,
      invalidatesTags: ['OwnDelivery'],
    }),

    // Admin
    adminOwnDelivery: b.query<OwnDeliveryShopView[], { status?: 'PENDING' | 'APPROVED' | 'REJECTED' }>({
      query: (params) => `/admin/own-delivery${qs(params)}`,
      transformResponse: unwrap<OwnDeliveryShopView[]>,
      providesTags: ['OwnDelivery'],
    }),
    adminDecideOwnDelivery: b.mutation<OwnDeliveryShopView, { sellerId: string } & OwnDeliveryDecisionInput>({
      query: ({ sellerId, ...body }) => ({ url: `/admin/own-delivery/${sellerId}`, method: 'PATCH', body }),
      transformResponse: unwrap<OwnDeliveryShopView>,
      invalidatesTags: ['OwnDelivery'],
    }),
    adminSellerAdjustments: b.query<SellerAdjustmentView[], string>({
      query: (sellerId) => `/admin/sellers/${sellerId}/adjustments`,
      transformResponse: unwrap<SellerAdjustmentView[]>,
      providesTags: ['OwnDelivery'],
    }),
    adminAddAdjustment: b.mutation<SellerAdjustmentView[], { sellerId: string } & SellerAdjustmentInput>({
      query: ({ sellerId, ...body }) => ({ url: `/admin/sellers/${sellerId}/adjustments`, method: 'POST', body }),
      transformResponse: unwrap<SellerAdjustmentView[]>,
      invalidatesTags: ['OwnDelivery', 'Payouts'],
    }),
    adminDeliveryDisputes: b.query<OpenDisputeView[], void>({
      query: () => '/admin/delivery-disputes',
      transformResponse: unwrap<OpenDisputeView[]>,
      providesTags: ['OwnDelivery'],
    }),
    adminResolveDispute: b.mutation<null, { orderId: string; subOrderId: string } & ResolveDisputeInput>({
      query: ({ orderId, subOrderId, ...body }) => ({ url: `/admin/orders/${orderId}/sub-orders/${subOrderId}/dispute/resolve`, method: 'POST', body }),
      invalidatesTags: ['OwnDelivery', 'AdminOrders'],
    }),

    // Customer
    reportNotReceived: b.mutation<null, { orderId: string; subOrderId: string } & DeliveryDisputeInput>({
      query: ({ orderId, subOrderId, ...body }) => ({ url: `/orders/${orderId}/packages/${subOrderId}/not-received`, method: 'POST', body }),
      invalidatesTags: ['Orders'],
    }),
  }),
});

export const {
  useOwnDeliveryQuery,
  useSaveOwnDeliveryMutation,
  useStopOwnDeliveryMutation,
  useAdminOwnDeliveryQuery,
  useAdminDecideOwnDeliveryMutation,
  useAdminSellerAdjustmentsQuery,
  useAdminAddAdjustmentMutation,
  useAdminDeliveryDisputesQuery,
  useAdminResolveDisputeMutation,
  useReportNotReceivedMutation,
} = ownDeliveryApi;
