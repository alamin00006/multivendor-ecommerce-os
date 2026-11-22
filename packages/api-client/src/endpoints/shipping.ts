import type {
  BookShipmentInput,
  CourierAccountInput,
  CourierAccountView,
  CourierLocation,
  CourierOption,
  CourierProvider,
  CourierStoreInput,
  ShipmentView,
} from '@marketbd/shared';
import { baseApi, unwrap } from '../base-api.js';

/** Whose courier setup: a seller's own shop, or the admin's house store. */
export type CourierScope = 'seller' | 'admin';

const optionsUrl = (scope: CourierScope) => (scope === 'seller' ? '/seller/couriers' : '/admin/courier-options');
const slug = (p: CourierProvider) => p.toLowerCase();
const shipmentUrl = (a: { scope: CourierScope; orderId: string; subOrderId: string }) =>
  a.scope === 'seller' ? `/seller/orders/${a.subOrderId}/shipment` : `/admin/orders/${a.orderId}/sub-orders/${a.subOrderId}/shipment`;

/** Couriers: admin accounts, pickup stores, booking and status refresh. */
export const shippingApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    // Admin → Couriers
    courierAccounts: b.query<CourierAccountView[], void>({
      query: () => '/admin/couriers',
      transformResponse: unwrap<CourierAccountView[]>,
      providesTags: ['Courier'],
    }),
    saveCourierAccount: b.mutation<CourierAccountView, { provider: CourierProvider; body: CourierAccountInput }>({
      query: ({ provider, body }) => ({ url: `/admin/couriers/${slug(provider)}`, method: 'PUT', body }),
      transformResponse: unwrap<CourierAccountView>,
      invalidatesTags: ['Courier'],
    }),
    testCourierAccount: b.mutation<{ message: string }, CourierProvider>({
      query: (provider) => ({ url: `/admin/couriers/${slug(provider)}/test`, method: 'POST' }),
      transformResponse: unwrap<{ message: string }>,
    }),
    rotateCourierWebhookSecret: b.mutation<CourierAccountView, CourierProvider>({
      query: (provider) => ({ url: `/admin/couriers/${slug(provider)}/webhook-secret`, method: 'POST' }),
      transformResponse: unwrap<CourierAccountView>,
      invalidatesTags: ['Courier'],
    }),

    // Courier options and pickup stores
    courierOptions: b.query<CourierOption[], CourierScope>({
      query: (scope) => optionsUrl(scope),
      transformResponse: unwrap<CourierOption[]>,
      providesTags: ['Courier'],
    }),
    saveCourierStore: b.mutation<CourierOption[], { scope: CourierScope; provider: CourierProvider; body: CourierStoreInput }>({
      query: ({ scope, provider, body }) => ({
        url: scope === 'seller' ? `/seller/couriers/${slug(provider)}/store` : `/admin/courier-options/${slug(provider)}/store`,
        method: 'PUT',
        body,
      }),
      transformResponse: unwrap<CourierOption[]>,
      invalidatesTags: ['Courier'],
    }),
    courierCities: b.query<CourierLocation[], CourierProvider>({
      query: (provider) => `/couriers/${slug(provider)}/cities`,
      transformResponse: unwrap<CourierLocation[]>,
      keepUnusedDataFor: 3600,
    }),
    courierZones: b.query<CourierLocation[], { provider: CourierProvider; cityId: number }>({
      query: ({ provider, cityId }) => `/couriers/${slug(provider)}/cities/${cityId}/zones`,
      transformResponse: unwrap<CourierLocation[]>,
      keepUnusedDataFor: 3600,
    }),
    courierAreas: b.query<CourierLocation[], { provider: CourierProvider; zoneId: number }>({
      query: ({ provider, zoneId }) => `/couriers/${slug(provider)}/zones/${zoneId}/areas`,
      transformResponse: unwrap<CourierLocation[]>,
      keepUnusedDataFor: 3600,
    }),

    // Booking
    bookShipment: b.mutation<ShipmentView, { scope: CourierScope; orderId: string; subOrderId: string; body: BookShipmentInput }>({
      query: ({ body, ...a }) => ({ url: shipmentUrl(a), method: 'POST', body }),
      transformResponse: unwrap<ShipmentView>,
      invalidatesTags: ['SellerOrders', 'AdminOrders', 'SellerDashboard'],
    }),
    syncShipment: b.mutation<ShipmentView, { scope: CourierScope; orderId: string; subOrderId: string }>({
      query: (a) => ({ url: `${shipmentUrl(a)}/sync`, method: 'POST' }),
      transformResponse: unwrap<ShipmentView>,
      invalidatesTags: ['SellerOrders', 'AdminOrders'],
    }),
  }),
});

export const {
  useCourierAccountsQuery,
  useSaveCourierAccountMutation,
  useTestCourierAccountMutation,
  useRotateCourierWebhookSecretMutation,
  useCourierOptionsQuery,
  useSaveCourierStoreMutation,
  useCourierCitiesQuery,
  useCourierZonesQuery,
  useCourierAreasQuery,
  useBookShipmentMutation,
  useSyncShipmentMutation,
} = shippingApi;
