/**
 * Admin staff permissions. An admin account holds a list of areas; `all` is the owner (full access,
 * including staff accounts and the activity log). The same map guards API routes (`/admin/<segment>`)
 * and hides admin panel pages (`/<segment>`).
 */
export const ADMIN_AREAS = ['orders', 'catalog', 'marketing', 'sellers', 'finance', 'customers', 'support', 'settings'] as const;
export type AdminArea = (typeof ADMIN_AREAS)[number];
export const FULL_ADMIN_ACCESS = 'all';
export type AdminPermission = AdminArea | typeof FULL_ADMIN_ACCESS;

export const ADMIN_AREA_INFO: Record<AdminArea, { label: string; description: string }> = {
  orders: { label: 'Orders', description: 'Orders, returns, refunds, couriers, shipments and POS' },
  catalog: { label: 'Catalog', description: 'Products, categories, brands, reviews and questions' },
  marketing: { label: 'Marketing', description: 'Banners, quick links, campaigns, flash sales and vouchers' },
  sellers: { label: 'Sellers', description: 'Seller approval and shop delivery' },
  finance: { label: 'Finance', description: 'Sales reports, payouts and seller balance adjustments' },
  customers: { label: 'Customers', description: 'Customer accounts' },
  support: { label: 'Support', description: 'Customer messages' },
  settings: { label: 'Settings', description: 'Store settings, brand and delivery rules' },
};

/** `any`: every admin staff member; `owner`: full-access admins only. */
export type AdminRouteArea = AdminArea | 'any' | 'owner';

const SEGMENT_AREA: Record<string, AdminRouteArea> = {
  '': 'any',
  dashboard: 'any',
  orders: 'orders',
  returns: 'orders',
  pos: 'orders',
  receipt: 'orders',
  courier: 'orders',
  couriers: 'orders',
  'courier-options': 'orders',
  'delivery-disputes': 'orders',
  products: 'catalog',
  categories: 'catalog',
  brands: 'catalog',
  reviews: 'catalog',
  questions: 'catalog',
  banners: 'marketing',
  'quick-links': 'marketing',
  campaigns: 'marketing',
  'flash-sales': 'marketing',
  coupons: 'marketing',
  sellers: 'sellers',
  'own-delivery': 'sellers',
  'shop-delivery': 'sellers',
  payouts: 'finance',
  reports: 'finance',
  users: 'customers',
  chat: 'support',
  messages: 'support',
  settings: 'settings',
  staff: 'owner',
  activity: 'owner',
};

/**
 * Area for a path below the admin root: an API path after `/admin/` (`sellers/x/adjustments`)
 * or an admin panel path (`/payouts`). Unknown paths need the owner.
 */
export function adminAreaFor(path: string): AdminRouteArea {
  const parts = path.replace(/^\/+/, '').split(/[/?#]/);
  if (parts[0] === 'sellers' && parts[2] === 'adjustments') return 'finance';
  return SEGMENT_AREA[parts[0] ?? ''] ?? 'owner';
}

export function hasAdminArea(permissions: readonly string[], area: AdminRouteArea): boolean {
  if (area === 'any') return true;
  if (permissions.includes(FULL_ADMIN_ACCESS)) return true;
  return area !== 'owner' && permissions.includes(area);
}
