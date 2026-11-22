/**
 * URL helpers shared by the storefront (apps/web), the admin app (apps/admin) and the
 * Seller Center (apps/partner-admin). The panels run on their own origins, so storefront links must be absolute there.
 */

/** Storefront URL. Empty base (relative link) inside apps/web, absolute inside the panel apps. */
export const storeUrl = (path: string): string => `${process.env.NEXT_PUBLIC_STORE_URL ?? ''}${path}`;

/** Seller Center URL (apps/partner-admin), for links from the storefront. */
export const partnerUrl = (path = '/'): string => `${process.env.NEXT_PUBLIC_PARTNER_URL ?? 'http://localhost:3102'}${path}`;

/** Where product management lives. Both panel apps serve it at /products. */
export const productsPath = (_scope: 'seller' | 'admin'): string => '/products';
