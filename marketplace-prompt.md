# Master Prompt: Multi-Vendor Marketplace (Bangladesh) — Web + Mobile + API

> Paste this into Claude Code at the root of an empty folder. Run it phase by phase (see "Execution Plan"). After each phase, say "next phase".

---

## Role & Goal

You are a senior full-stack engineer. Build a production-ready, multi-vendor e-commerce marketplace for the Bangladesh market (Daraz/Cartup-style structure), with:

- **Web** (customer storefront + seller panel + admin panel)
- **Mobile app** (customer storefront)
- **Backend API**

Brand name: **MarketBD** (placeholder — keep it in one config constant so it can be renamed easily).
Use an original visual identity: own logo placeholder, own color tokens, own copy. Do NOT copy assets, logos, banners, text or product data from any existing website.

## Design Reference — https://cartup.com

Use **https://cartup.com** as the layout and UX reference for the web storefront and mobile app.

Process for EVERY page/screen you build:
1. First open the matching page on cartup.com (home, category, search results, product detail, campaign page, cart, checkout, login/signup, account, orders, help/content pages) and study it on both desktop and mobile width.
2. Write a short breakdown: section order, grid/columns, component types (slider, chips, product card, countdown, filters sidebar, sticky header, bottom bar), spacing scale, card anatomy, hover/empty/loading states, responsive behaviour.
3. Then build our page to match that structure, layout, section order, component behaviour and interaction flow closely.
4. Keep these ours, not theirs: brand name, logo, color palette, fonts, icons, banner/product images, all copy and text. Use our design tokens from `packages/config`.
5. After building, compare our page against the reference side by side and fix layout/spacing differences before moving on.

For the mobile app, follow the same section order and card patterns as cartup.com's mobile web view, adapted to native components.

## Tech Stack (strict — do not substitute or add alternatives without asking me)

| Layer | Stack |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Web | Next.js (App Router, TypeScript), Redux Toolkit + RTK Query, Tailwind CSS |
| Mobile | React Native with Expo (Expo Router, TypeScript), Redux Toolkit + RTK Query, NativeWind |
| Backend | NestJS (TypeScript), Prisma ORM, PostgreSQL, Zod (via `nestjs-zod`) |
| Shared | `packages/shared`: Zod schemas, inferred TS types, enums, constants — used by web, mobile AND api |
| Infra (local) | Docker Compose for PostgreSQL (+ Redis only if needed for OTP/rate limit) |

If any library choice beyond this table is needed, pick the most standard one and list it in the README.

## Folder Structure

```
/apps
  /web        -> Next.js (storefront + /seller + /admin route groups)
  /mobile     -> Expo app
  /api        -> NestJS
/packages
  /shared     -> zod schemas, types, enums, constants (BDT formatting, BD divisions/districts)
  /api-client -> RTK Query base API + endpoint definitions shared by web & mobile
  /config     -> eslint, tsconfig, tailwind preset (design tokens)
docker-compose.yml
.env.example (per app)
README.md
```

## Global Rules

1. Production-ready code only. No `TODO`, no placeholder functions, no `any`.
2. Every request body/query is validated with Zod schemas from `packages/shared`. Same schemas validate forms on web (react-hook-form + zodResolver) and mobile.
3. RTK Query endpoints live once in `packages/api-client` and are consumed by both web and mobile. Use tags for cache invalidation.
4. Currency is BDT, shown as `৳1,250`. Prices stored as integers (poisha) in DB.
5. i18n: English + Bangla (বাংলা) for UI strings, language toggle on web and mobile.
6. Addresses use Bangladesh Division → District → Area (seed full division/district list).
7. Consistent API response shape: `{ success, data, message, meta? }`, global exception filter, pagination via `page`/`limit` with `meta.total`.
8. Security: helmet, CORS, rate limiting on auth/OTP, bcrypt/argon2 passwords, JWT access (15m) + refresh (7d, rotated, stored hashed).
9. Images: upload to S3-compatible storage (MinIO in docker for local) and serve through an image-resize endpoint (`GET /images/resize?url=&width=`) with caching headers.
10. Mobile-first responsive web; dark mode optional, light mode required.
11. Write a seed script with realistic demo data: 14 categories (with sub-categories), 3 sellers, 80+ products with variants, 2 campaigns, 1 active flash sale.
12. After each phase: run typecheck + lint + tests, fix errors, then summarise what was built and how to run it.

## Roles

- `CUSTOMER`, `SELLER`, `ADMIN` (RBAC guards in NestJS, route protection on web/mobile).

## Marketplace Mode — Multi-Vendor ON / OFF

The same codebase must run as either a **multi-vendor marketplace** or a **single-vendor store**, switchable by the admin without code changes or redeploy.

**Storage & access**
- `PlatformSetting` table (singleton row) with `multiVendorEnabled: boolean` (+ room for future flags). Initial value comes from env `MULTI_VENDOR_ENABLED` on first seed only; after that the DB value is the source of truth.
- Admin panel → Settings page with a toggle and a confirmation modal explaining what changes.
- Public endpoint `GET /api/v1/settings/public` returns the flag (cached, invalidated on change). Web and mobile read it through RTK Query (`settings` tag) and also at server render in Next.js.
- Backend: a `MultiVendorGuard` / `@RequireMultiVendor()` decorator blocks all seller-only endpoints when the mode is OFF (returns 403 with a clear message).

**Default store**
- The seed always creates one **house store** (`SellerProfile` with `isHouseStore = true`), owned by the admin. In single-vendor mode every product belongs to it, and admin manages products directly from `/admin/products` (same product form as the seller panel, reused component).

**When multi-vendor is OFF**
- Seller registration, `/seller` routes and seller login are disabled (Next.js middleware redirects; mobile hides entry points).
- Storefront hides seller/shop name, shop pages, "Sold by" blocks and seller ratings.
- Only house-store products are listed. Products of other sellers are hidden, NOT deleted.
- Checkout creates one order with a single SubOrder (keep the same order pipeline so no separate code path).
- Admin panel hides seller management menus and commission reports.

**When multi-vendor is ON**
- Everything described under "Seller panel" works, the house store acts as one of the sellers.
- Previously hidden seller products become visible again automatically (status unchanged).
- Orders split into SubOrders per seller.
- Admin can set a default commission % per seller (`SellerProfile.commissionRate`), stored on each SubOrder at order time.

**Rules**
- Never branch on the flag in random places: put the logic in a `PlatformModeService` (api) and a `useMarketplaceMode()` hook (web + mobile) and use those everywhere.
- Toggling must not break existing orders, carts or reviews. If a cart contains now-hidden products, mark them unavailable at cart load and block checkout for those items.
- Write tests covering both modes: product listing, seller endpoints access, checkout/order split.

## Data Model (Prisma) — minimum

PlatformSetting (singleton: multiVendorEnabled), User, Address, SellerProfile (shop name, slug, logo, status: PENDING/APPROVED/SUSPENDED, isHouseStore, commissionRate), Category (self-relation tree, icon, sortOrder), Brand, Product (title, slug, description, seller, category, brand, status, ratingAvg, soldCount), ProductVariant (sku, attributes JSON e.g. color/size, price, compareAtPrice, stock), ProductImage, Cart, CartItem, Wishlist, Order (orderNumber, status, paymentMethod, paymentStatus, subtotal, shippingFee, discount, total), OrderItem (snapshot of title/price/variant), SubOrder per seller (multi-vendor split), Payment, Review (with images, verified purchase flag), Coupon/Voucher, Campaign (slug, title, banner, type, startAt, endAt, isActive), CampaignProduct, FlashSale + FlashSaleItem (special price, stock limit), Banner (home slider, link target), QuickLink (home chips), Notification, OtpCode.

Order status flow: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED, plus CANCELLED / RETURN_REQUESTED / RETURNED / REFUNDED. Enforce valid transitions in a service.

## Features

### Customer (web + mobile)
- Home: hero banner slider (admin-managed), quick-link chips, flash sale section with live countdown + discount % + "X sold" / "Limited stock" badge, recommended categories grid, infinite-scroll "Deals for you" feed, app download block (web only)
- Category page with filters (price range, brand, rating, attributes) + sorting
- Search with autocomplete suggestions (PostgreSQL full-text search)
- Product detail: image gallery, variant picker, stock, seller info, reviews, related products
- Campaign/mega pages rendered dynamically from admin data (`/campaign/[slug]`)
- Cart (guest cart in local storage → merges on login), wishlist
- Checkout: address book, shipping fee by Inside Dhaka / Outside Dhaka, coupon apply, payment methods: Cash on Delivery (full), bKash + SSLCommerz (implement service interface + sandbox integration, configurable via env)
- Auth: email/password + phone OTP login (OTP provider behind an interface; console logger in dev)
- Orders list, order detail with status timeline, cancel (allowed states only), return request
- Profile, addresses, notifications
- Mobile: bottom tabs (Home, Categories, Cart, Account), pull-to-refresh, secure token storage (expo-secure-store), deep link scheme `marketbd://`

### Seller panel (web `/seller`)
- Register shop → admin approval
- Product CRUD with variants and image upload, stock management
- Orders (their sub-orders only), update fulfilment status
- Dashboard: sales total, orders count, low stock list

### Admin panel (web `/admin`)
- Settings: Multi-vendor mode ON/OFF toggle (see "Marketplace Mode")
- Products CRUD for the house store (used mainly in single-vendor mode)
- Approve/suspend sellers, set commission (multi-vendor mode only), manage users
- Category tree, brands
- Home banners, quick links, campaigns (attach products), flash sales
- Coupons
- All orders, status override, refunds
- Dashboard with basic stats

## API
- Prefix `/api/v1`, Swagger docs at `/docs` (generated from Zod schemas)
- Modules: auth, users, addresses, sellers, categories, brands, products, search, cart, wishlist, orders, payments, reviews, coupons, campaigns, flash-sales, banners, uploads, images, notifications, admin
- Unit tests for services with business logic (orders, cart pricing, coupons, flash sale stock) + e2e tests for auth and checkout

## Execution Plan (do ONE phase at a time, wait for "next phase")

1. **Setup**: monorepo, configs, docker-compose (Postgres + MinIO), shared package, Prisma schema + migration + seed, README.
2. **API core**: auth (JWT + refresh + OTP), users, RBAC, platform settings + `PlatformModeService` + `MultiVendorGuard`, categories, brands, products (mode-aware listing), uploads/images, Swagger.
3. **API commerce**: cart, wishlist, coupons, orders (multi-vendor split + status machine), payments (COD + bKash + SSLCommerz), reviews, campaigns, flash sales, banners, notifications. Tests.
4. **api-client package**: RTK Query base API (token refresh on 401), all endpoints with tags.
5. **Web storefront**: layout, home, category, search, product, campaign, cart, checkout, auth, account/orders. i18n.
6. **Web seller panel**.
7. **Web admin panel**.
8. **Mobile app**: all customer features from the list above.
9. **Hardening**: error/loading/empty states everywhere, SEO metadata + sitemap for web, performance pass (Next Image, pagination, DB indexes), final typecheck/lint/test, update README with run instructions for all three apps.

Start with Phase 1 now. Before writing code, show me the final folder tree and the Prisma schema for approval.
