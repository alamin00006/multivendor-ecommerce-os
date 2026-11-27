import type { ActivityListQuery, ActivityView, AdminReport, SellerReportQuery, CreateStaffInput, StaffView, UpdateStaffInput } from '@marketbd/shared';
import { baseApi, type Page, qs, unwrap, unwrapPage } from '../base-api.js';

/** Admin staff accounts, the admin activity log and the marketplace sales report. */
export const staffApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    adminStaff: b.query<StaffView[], void>({
      query: () => '/admin/staff',
      transformResponse: unwrap<StaffView[]>,
      providesTags: ['Staff'],
    }),
    adminCreateStaff: b.mutation<StaffView, CreateStaffInput>({
      query: (body) => ({ url: '/admin/staff', method: 'POST', body }),
      transformResponse: unwrap<StaffView>,
      invalidatesTags: ['Staff', 'Activity', 'AdminUsers'],
    }),
    adminUpdateStaff: b.mutation<StaffView, { id: string } & UpdateStaffInput>({
      query: ({ id, ...body }) => ({ url: `/admin/staff/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<StaffView>,
      invalidatesTags: ['Staff', 'Activity', 'AdminUsers'],
    }),
    adminActivity: b.query<Page<ActivityView>, ActivityListQuery>({
      query: (params) => `/admin/activity${qs(params)}`,
      transformResponse: unwrapPage<ActivityView>,
      providesTags: ['Activity'],
    }),
    adminReport: b.query<AdminReport, SellerReportQuery>({
      query: (params) => `/admin/reports${qs(params)}`,
      transformResponse: unwrap<AdminReport>,
      providesTags: ['SellerReports'],
    }),
  }),
});

export const { useAdminStaffQuery, useAdminCreateStaffMutation, useAdminUpdateStaffMutation, useAdminActivityQuery, useAdminReportQuery } = staffApi;
