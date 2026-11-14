/**
 * URL helpers shared by the storefront (apps/web) and the admin app (apps/admin).
 * The admin app runs on its own origin, so storefront links must be absolute there.
 */

/** Storefront URL. Empty base (relative link) inside apps/web, absolute inside apps/admin. */
export const storeUrl = (path: string): string => `${process.env.NEXT_PUBLIC_STORE_URL ?? ''}${path}`;

/** Where product management lives: /seller/products in the storefront app, /products in the admin app. */
export const productsPath = (scope: 'seller' | 'admin'): string => (scope === 'seller' ? '/seller/products' : '/products');
