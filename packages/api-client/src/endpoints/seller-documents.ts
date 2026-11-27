import type { DocumentQueueRow, ReviewSellerDocumentInput, SellerDocumentsView, SellerDocumentType } from '@marketbd/shared';
import { baseApi, qs, unwrap } from '../base-api.js';

/** Opens a private document: the file comes back as a short-lived object URL for this tab. */
const fileUrl = async (response: Response) => (response.ok ? URL.createObjectURL(await response.blob()) : ((await response.json()) as unknown));

/** Shop verification documents (seller side and admin review). */
export const sellerDocumentsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    myDocuments: b.query<SellerDocumentsView, void>({
      query: () => '/sellers/me/documents',
      transformResponse: unwrap<SellerDocumentsView>,
      providesTags: ['SellerDocuments'],
    }),
    uploadDocument: b.mutation<SellerDocumentsView, { type: SellerDocumentType; file: FormData }>({
      query: ({ type, file }) => ({ url: `/sellers/me/documents${qs({ type })}`, method: 'POST', body: file }),
      transformResponse: unwrap<SellerDocumentsView>,
      invalidatesTags: ['SellerDocuments'],
    }),
    removeDocument: b.mutation<SellerDocumentsView, string>({
      query: (id) => ({ url: `/sellers/me/documents/${id}`, method: 'DELETE' }),
      transformResponse: unwrap<SellerDocumentsView>,
      invalidatesTags: ['SellerDocuments'],
    }),
    /** `sellerId` set: admin view of a shop's file; otherwise the shop's own. Returns an object URL. */
    openDocument: b.mutation<string, { id: string; sellerId?: string }>({
      query: ({ id, sellerId }) => ({
        url: sellerId ? `/admin/seller-documents/${sellerId}/${id}/file` : `/sellers/me/documents/${id}/file`,
        responseHandler: fileUrl,
      }),
    }),
    adminDocumentQueue: b.query<DocumentQueueRow[], void>({
      query: () => '/admin/seller-documents',
      transformResponse: unwrap<DocumentQueueRow[]>,
      providesTags: ['SellerDocuments'],
    }),
    adminSellerDocuments: b.query<SellerDocumentsView, string>({
      query: (sellerId) => `/admin/seller-documents/${sellerId}`,
      transformResponse: unwrap<SellerDocumentsView>,
      providesTags: ['SellerDocuments'],
    }),
    adminReviewDocument: b.mutation<SellerDocumentsView, { sellerId: string; id: string } & ReviewSellerDocumentInput>({
      query: ({ sellerId, id, ...body }) => ({ url: `/admin/seller-documents/${sellerId}/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<SellerDocumentsView>,
      invalidatesTags: ['SellerDocuments', 'AdminSellers'],
    }),
    adminVerifySeller: b.mutation<SellerDocumentsView, { sellerId: string; verified: boolean }>({
      query: ({ sellerId, verified }) => ({ url: `/admin/seller-documents/${sellerId}/verification`, method: 'PUT', body: { verified } }),
      transformResponse: unwrap<SellerDocumentsView>,
      invalidatesTags: ['SellerDocuments', 'AdminSellers'],
    }),
  }),
});

export const {
  useMyDocumentsQuery,
  useUploadDocumentMutation,
  useRemoveDocumentMutation,
  useOpenDocumentMutation,
  useAdminDocumentQueueQuery,
  useAdminSellerDocumentsQuery,
  useAdminReviewDocumentMutation,
  useAdminVerifySellerMutation,
} = sellerDocumentsApi;
