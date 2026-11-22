import type { PosProduct, PosProductQuery, PosSaleInput, PosSaleResult } from '@marketbd/shared';
import { baseApi, qs, unwrap } from '../base-api.js';

/** Admin → POS: counter sales of house-store products (cash only for now). */
export const posApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    posProducts: b.query<PosProduct[], Partial<PosProductQuery>>({
      query: (params) => `/admin/pos/products${qs(params)}`,
      transformResponse: unwrap<PosProduct[]>,
      providesTags: ['PosProducts'],
    }),
    posSell: b.mutation<PosSaleResult, PosSaleInput>({
      query: (body) => ({ url: '/admin/pos/sales', method: 'POST', body }),
      transformResponse: unwrap<PosSaleResult>,
      // Stock changed: refresh the POS list, catalogue and order screens.
      invalidatesTags: ['PosProducts', 'AdminOrders', 'AdminDashboard', 'Products', 'Product'],
    }),
    posReceipt: b.query<PosSaleResult, string>({
      query: (id) => `/admin/pos/sales/${id}`,
      transformResponse: unwrap<PosSaleResult>,
    }),
  }),
});

export const { usePosProductsQuery, usePosSellMutation, usePosReceiptQuery } = posApi;
