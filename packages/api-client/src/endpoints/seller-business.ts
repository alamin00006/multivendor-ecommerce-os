import type {
  AdminPayoutUpdateInput,
  BulkStockResult,
  BulkStockUpdateInput,
  EarningRow,
  PayoutAccountInput,
  PayoutListQuery,
  PayoutRequestInput,
  PayoutView,
  PosProduct,
  PosProductQuery,
  PosSaleInput,
  PosSaleResult,
  ReturnStatus,
  ReviewReplyInput,
  SellerEarnings,
  SellerReport,
  SellerReportQuery,
  SellerReturnUpdateInput,
  SellerReturnView,
  SellerReviewQuery,
  SellerReviewStats,
  SellerReviewView,
} from '@marketbd/shared';
import { baseApi, type Page, qs, unwrap, unwrapPage } from '../base-api.js';

export interface StockSheetRow {
  sku: string;
  title: string;
  variant: string;
  price: number;
  stock: number;
}

/** Seller business tools: earnings & payouts, returns, reviews, reports, bulk stock and the shop's own POS. */
export const sellerBusinessApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    // ───── Earnings & payouts ─────
    sellerEarnings: b.query<SellerEarnings, void>({
      query: () => '/seller/earnings',
      transformResponse: unwrap<SellerEarnings>,
      providesTags: ['Earnings'],
    }),
    sellerLedger: b.query<Page<EarningRow>, { page?: number; limit?: number }>({
      query: (params) => `/seller/earnings/ledger${qs(params)}`,
      transformResponse: unwrapPage<EarningRow>,
      providesTags: ['Earnings'],
    }),
    savePayoutAccount: b.mutation<SellerEarnings, PayoutAccountInput>({
      query: (body) => ({ url: '/seller/payout-account', method: 'PUT', body }),
      transformResponse: unwrap<SellerEarnings>,
      invalidatesTags: ['Earnings'],
    }),
    sellerPayouts: b.query<Page<PayoutView>, PayoutListQuery>({
      query: (params) => `/seller/payouts${qs(params)}`,
      transformResponse: unwrapPage<PayoutView>,
      providesTags: ['Payouts'],
    }),
    requestPayout: b.mutation<PayoutView, PayoutRequestInput>({
      query: (body) => ({ url: '/seller/payouts', method: 'POST', body }),
      transformResponse: unwrap<PayoutView>,
      invalidatesTags: ['Earnings', 'Payouts'],
    }),
    cancelPayout: b.mutation<PayoutView, string>({
      query: (id) => ({ url: `/seller/payouts/${id}/cancel`, method: 'POST' }),
      transformResponse: unwrap<PayoutView>,
      invalidatesTags: ['Earnings', 'Payouts'],
    }),
    adminPayouts: b.query<Page<PayoutView>, PayoutListQuery>({
      query: (params) => `/admin/payouts${qs(params)}`,
      transformResponse: unwrapPage<PayoutView>,
      providesTags: ['Payouts'],
    }),
    adminProcessPayout: b.mutation<PayoutView, { id: string } & AdminPayoutUpdateInput>({
      query: ({ id, ...body }) => ({ url: `/admin/payouts/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<PayoutView>,
      invalidatesTags: ['Payouts'],
    }),

    // ───── Returns ─────
    sellerReturns: b.query<Page<SellerReturnView>, { page?: number; limit?: number; status?: ReturnStatus }>({
      query: (params) => `/seller/orders/returns${qs(params)}`,
      transformResponse: unwrapPage<SellerReturnView>,
      providesTags: ['SellerReturns'],
    }),
    sellerUpdateReturn: b.mutation<SellerReturnView, { id: string } & SellerReturnUpdateInput>({
      query: ({ id, ...body }) => ({ url: `/seller/orders/returns/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<SellerReturnView>,
      invalidatesTags: ['SellerReturns', 'SellerOrders', 'Earnings', 'SellerDashboard'],
    }),

    // ───── Reviews ─────
    sellerReviews: b.query<Page<SellerReviewView>, SellerReviewQuery>({
      query: (params) => `/seller/reviews${qs(params)}`,
      transformResponse: unwrapPage<SellerReviewView>,
      providesTags: ['SellerReviews'],
    }),
    sellerReviewStats: b.query<SellerReviewStats, void>({
      query: () => '/seller/reviews/stats',
      transformResponse: unwrap<SellerReviewStats>,
      providesTags: ['SellerReviews'],
    }),
    replyToReview: b.mutation<SellerReviewView, { id: string } & ReviewReplyInput>({
      query: ({ id, ...body }) => ({ url: `/seller/reviews/${id}/reply`, method: 'PUT', body }),
      transformResponse: unwrap<SellerReviewView>,
      invalidatesTags: ['SellerReviews', 'Reviews'],
    }),
    deleteReviewReply: b.mutation<SellerReviewView, string>({
      query: (id) => ({ url: `/seller/reviews/${id}/reply`, method: 'DELETE' }),
      transformResponse: unwrap<SellerReviewView>,
      invalidatesTags: ['SellerReviews', 'Reviews'],
    }),

    // ───── Reports ─────
    sellerReport: b.query<SellerReport, SellerReportQuery>({
      query: (params) => `/seller/reports${qs(params)}`,
      transformResponse: unwrap<SellerReport>,
      providesTags: ['SellerReports'],
    }),

    // ───── Bulk price / stock ─────
    sellerStockSheet: b.query<StockSheetRow[], void>({
      query: () => '/seller/products/stock-sheet',
      transformResponse: unwrap<StockSheetRow[]>,
      providesTags: ['SellerProducts'],
    }),
    sellerBulkStock: b.mutation<BulkStockResult, BulkStockUpdateInput>({
      query: (body) => ({ url: '/seller/products/bulk-stock', method: 'POST', body }),
      transformResponse: unwrap<BulkStockResult>,
      invalidatesTags: ['SellerProducts', 'SellerDashboard', 'Products', 'Product', 'PosProducts'],
    }),

    // ───── Shop POS ─────
    sellerPosProducts: b.query<PosProduct[], Partial<PosProductQuery>>({
      query: (params) => `/seller/pos/products${qs(params)}`,
      transformResponse: unwrap<PosProduct[]>,
      providesTags: ['PosProducts'],
    }),
    sellerPosSell: b.mutation<PosSaleResult, PosSaleInput>({
      query: (body) => ({ url: '/seller/pos/sales', method: 'POST', body }),
      transformResponse: unwrap<PosSaleResult>,
      invalidatesTags: ['PosProducts', 'SellerOrders', 'SellerDashboard', 'SellerProducts', 'Earnings', 'SellerReports', 'Products', 'Product'],
    }),
    sellerPosReceipt: b.query<PosSaleResult, string>({
      query: (id) => `/seller/pos/sales/${id}`,
      transformResponse: unwrap<PosSaleResult>,
    }),
  }),
});

export const {
  useSellerEarningsQuery,
  useSellerLedgerQuery,
  useSavePayoutAccountMutation,
  useSellerPayoutsQuery,
  useRequestPayoutMutation,
  useCancelPayoutMutation,
  useAdminPayoutsQuery,
  useAdminProcessPayoutMutation,
  useSellerReturnsQuery,
  useSellerUpdateReturnMutation,
  useSellerReviewsQuery,
  useSellerReviewStatsQuery,
  useReplyToReviewMutation,
  useDeleteReviewReplyMutation,
  useSellerReportQuery,
  useSellerStockSheetQuery,
  useSellerBulkStockMutation,
  useSellerPosProductsQuery,
  useSellerPosSellMutation,
  useSellerPosReceiptQuery,
} = sellerBusinessApi;
