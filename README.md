# MarketBD — Multi-vendor marketplace for Bangladesh

MarketBD is a marketplace with a web storefront, a seller panel, an admin panel, a mobile app and a REST API. All of them live in one pnpm + Turborepo monorepo.

The brand name lives in one constant, `BRAND` in [packages/shared/src/constants.ts](packages/shared/src/constants.ts). Change it there to rename the store.

| App / package | Stack | Path |
|---|---|---|
| API | NestJS 12, Prisma 7, PostgreSQL 17, Zod (`nestjs-zod`) | [apps/api](apps/api) |
| Web | Next.js 16 App Router, Redux Toolkit + RTK Query, Tailwind CSS 4 | [apps/web](apps/web) |
| Mobile | Expo SDK 56 + Expo Router, RTK Query, NativeWind | [apps/mobile](apps/mobile) |
| Shared | Zod schemas, types, enums, BDT formatting, BD geo data, EN/BN UI strings | [packages/shared](packages/shared) |
| API client | RTK Query base API (refresh on 401), every endpoint, `useMarketplaceMode()` | [packages/api-client](packages/api-client) |
| Config | tsconfig bases, ESLint, design tokens (Tailwind v4 `@theme` and v3 preset) | [packages/config](packages/config) |

## Requirements

- Node.js 22 or newer
- pnpm 12 (`corepack enable`)
- Docker Desktop, for PostgreSQL and MinIO

## Quick start

```bash
pnpm install
pnpm db:up                                # PostgreSQL on :5440, MinIO on :9000 (console :9001)

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

pnpm --filter @marketbd/shared build      # shared packages are consumed from dist/
pnpm --filter @marketbd/api-client build
pnpm --filter @marketbd/config build

pnpm db:migrate                           # applies migrations (includes full-text search + constraints)
pnpm db:seed                              # demo data, safe to re-run
```

Then start each app in its own terminal:

```bash
pnpm --filter @marketbd/api dev           # http://localhost:4000/api/v1  · Swagger: http://localhost:4000/docs
pnpm --filter @marketbd/web dev           # http://localhost:3100
pnpm --filter @marketbd/mobile start      # Expo dev server → press a (Android) / i (iOS)
```

`pnpm dev` at the root starts the API and the web app together through Turborepo.

> PostgreSQL is published on port **5440**, not 5432, so it does not clash with a local PostgreSQL install. Change the port in `docker-compose.yml` and `DATABASE_URL` together if you need to.

### Demo accounts (from the seed)

| Role | Login | Password |
|---|---|---|
| Admin (owns the house store) | admin@marketbd.example | Admin@12345 |
| Seller: Gadget Ghor | gadgetghor@marketbd.example | Seller@12345 |
| Seller: Deshi Bazar | deshibazar@marketbd.example | Seller@12345 |
| Seller: Fresh Basket | freshbasket@marketbd.example | Seller@12345 |
| Customer | customer@marketbd.example | Customer@12345 |

Phone OTP login works with any Bangladeshi number. With `OTP_PROVIDER=console`, the code is printed in the API log.

Coupons: `WELCOME100` (৳100 off orders of ৳1,000 or more) and `SAVE10` (10% off, capped at ৳500, on orders of ৳2,000 or more).

The seed contains:

- 14 categories with 42 sub-categories and 12 brands
- 84 products with 183 variants, a third of them in the house store
- 3 approved sellers and 4 customers
- 140 reviews
- 2 live campaigns and 1 active flash sale
- Banners, quick links and coupons
- All 8 divisions and 64 districts, plus delivery areas: every Dhaka city thana, the Dhaka district upazilas, Chattogram city areas, and the Sadar area of every other district

## Marketplace mode (multi-vendor ON / OFF)

The admin turns the mode on or off at **Admin → Settings**. The change needs no redeploy.

- **Source of truth:** the `PlatformSetting` row. `MULTI_VENDOR_ENABLED` is read only on the first seed.
- **API:** all mode logic lives in `PlatformModeService`. `@RequireMultiVendor()` (enforced by `MultiVendorGuard`) returns 403 on seller endpoints when the mode is OFF.
- **Web and mobile:** both read the mode with `useMarketplaceMode()` from `@marketbd/api-client`. The web also reads it at server render. `apps/web/proxy.ts` redirects `/seller`, `/sell` and `/shop/*` when the mode is OFF.
- **When OFF:**
  - Only house-store products are listed. Other sellers' products are hidden, not deleted.
  - Seller names, "Sold by" blocks and seller ratings disappear from the storefront.
  - Cart items from hidden sellers are marked unavailable, and checkout is blocked for them.
  - Orders go through the same pipeline and produce a single sub-order.
  - Admin seller menus and commission figures are hidden.
- **When ON:**
  - Orders split into one `SubOrder` per seller.
  - Each sub-order stores the seller's `commissionRate` at order time.

## How things fit together

- **Validation:** request bodies and queries are validated with the Zod schemas in `@marketbd/shared`. The web and mobile forms use the same schemas through `react-hook-form` + `zodResolver` or `Schema.safeParse`.
- **Response shape:** every response is `{ success, data, message, meta? }`. Errors go through a global exception filter. Lists use `?page=&limit=` and return `meta.total`.
- **Auth:**
  - JWT access tokens last 15 minutes.
  - Refresh tokens last 7 days, are rotated on every use and are stored hashed. Reusing an old token revokes the whole token family.
  - The web keeps the refresh token in an httpOnly cookie. The browser reaches the API through the Next.js rewrite at `/api/v1`, so the cookie is same-origin.
  - The mobile app keeps the refresh token in `expo-secure-store`.
- **Money:** amounts are stored as integer poisha and formatted as `৳1,250` by `formatBDT`.
- **Order state machine:** `ORDER_STATUS_TRANSITIONS` in shared, enforced by `OrderStatusService`.
  - Cancelling a package returns its stock and its flash-sale allocation.
  - COD orders are marked paid when delivered.
- **Stock and flash sales:** stock is reserved with conditional updates inside the checkout transaction, so concurrent orders cannot oversell a variant or a flash-sale allocation.
- **Search:** PostgreSQL full-text search (trigger-maintained `tsvector` with a GIN index) plus a trigram index for typo-tolerant autocomplete.
- **Images:** uploads are re-encoded to WebP and stored in MinIO (S3 API). `GET /api/v1/images/resize?url=&width=` returns resized, cacheable images. The web's `next/image` loader and the mobile `img()` helper both use it.
- **Payments:** COD works out of the box. bKash (tokenized checkout) and SSLCommerz are implemented against their sandbox APIs. Enable them with `BKASH_*` / `SSLCOMMERZ_*` in `apps/api/.env`. After payment, the gateway redirects customers to `/checkout/result` on the web, or to `marketbd://checkout/result` in the app.
- **i18n:** English and Bangla strings live in `packages/shared/src/i18n`. The web stores the language in a cookie; the mobile app stores it in AsyncStorage.

## Mobile app

- Bottom tabs: Home, Categories, Cart and Account.
- Lists support pull-to-refresh and infinite scroll.
- The guest cart is kept on the device and merged into the account cart on sign-in.
- Deep link scheme: `marketbd://`.
- Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`:
  - Android emulator: `http://10.0.2.2:4000/api/v1`
  - iOS simulator: `http://localhost:4000/api/v1`
  - Physical phone: `http://<your-PC-LAN-IP>:4000/api/v1`. Also add that host to `CORS_ORIGINS` / `IMAGE_ALLOWED_HOSTS` if needed.

## Quality checks

```bash
pnpm typecheck                              # all workspaces
pnpm lint
pnpm test                                   # unit tests (shared + API services)
pnpm --filter @marketbd/api test:e2e        # e2e: auth + checkout in both modes (uses database marketbd_test)
```

The e2e suite drops and recreates the `marketbd_test` database on every run. It refuses to run against any database whose name does not end in `_test`.

## Useful URLs

- Swagger / OpenAPI: http://localhost:4000/docs
- MinIO console: http://localhost:9001 (user `marketbd`, password `marketbd-secret`)
- Sitemap: http://localhost:3100/sitemap.xml

## Libraries added beyond the core stack

argon2 (password hashing), helmet, cookie-parser, @nestjs/throttler (rate limiting), @nestjs/swagger, @aws-sdk/client-s3, sharp (image processing), react-hook-form + @hookform/resolvers, lucide-react / lucide-react-native (icons), embla-carousel (hero slider), sonner (toasts), expo-image, expo-secure-store, expo-web-browser, @react-native-async-storage/async-storage.

The upstream MinIO image is no longer published on Docker Hub. `docker-compose.yml` therefore uses `pgsty/minio`, a maintained community build of the same server.
