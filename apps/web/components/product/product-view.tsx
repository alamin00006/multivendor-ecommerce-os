'use client';

import {
  useAddToCart,
  useAvailableCouponsQuery,
  useBoughtTogetherQuery,
  useMarketplaceMode,
  useProductsQuery,
  usePublicSettingsQuery,
  useRelatedProductsQuery,
  useWishlistToggle,
} from '@marketbd/api-client';
import { discountPercent, type ProductDetail, type VariantView } from '@marketbd/shared';
import {
  ArrowDown,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
  RotateCcw,
  ShieldCheck,
  Star,
  Store,
  Ticket,
  Truck,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { fill } from '@/i18n';
import { useHydrated, useI18n, Button, cn, QuantityStepper, Stars } from '@marketbd/ui';
import { DealsFeed } from '@/components/home/home-sections';
import { Countdown } from './product-card';
import { rememberViewed } from '@/lib/recently-viewed';
import { ProductQuestions } from './product-questions';
import { ProductRow } from './product-row';
import { ProductReviews } from './product-reviews';

/** Variant matching every selected option, if any. */
const findVariant = (variants: VariantView[], sel: Record<string, string>) =>
  variants.find((v) => Object.entries(sel).every(([k, val]) => v.attributes[k] === val)) ?? null;

// ───────────────────────── Gallery ─────────────────────────

/** Heart button on the main image corner (as in the reference layout). */
function WishlistButton({ product }: { product: ProductDetail }) {
  const { t } = useI18n();
  const router = useRouter();
  const wishlist = useWishlistToggle(product.id);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!wishlist.authed) return router.push(`/login?next=/p/${product.slug}`);
        await wishlist.toggle();
      }}
      className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/90 shadow-card hover:bg-white"
      aria-label={t.product.saveToWishlist}
      aria-pressed={wishlist.saved}
    >
      <Heart className={cn('size-5', wishlist.saved ? 'fill-accent-500 text-accent-500' : 'text-ink-500')} />
    </button>
  );
}

function Gallery({ product, variantId }: { product: ProductDetail; variantId: string | null }) {
  const images = useMemo(() => {
    const own = product.images.filter((i) => variantId && i.variantId === variantId);
    return own.length ? [...own, ...product.images.filter((i) => i.variantId !== variantId)] : product.images;
  }, [product.images, variantId]);
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, images.length - 1)];
  const pct = product.discountPercent;
  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      <div className="scrollbar-none flex gap-2 overflow-x-auto md:max-h-[640px] md:w-[72px] md:flex-col md:overflow-y-auto">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onMouseEnter={() => setIndex(i)}
            onClick={() => setIndex(i)}
            className={cn(
              'relative size-14 shrink-0 overflow-hidden rounded-md border-2 bg-ink-50 md:size-[72px]',
              i === index ? 'border-primary-600' : 'border-transparent hover:border-ink-200',
            )}
            aria-label={`Image ${i + 1}`}
          >
            <Image src={img.url} alt="" fill sizes="72px" className="object-cover" />
          </button>
        ))}
      </div>
      <div className="relative aspect-square flex-1 overflow-hidden rounded-lg bg-ink-50">
        {current && <Image src={current.url} alt={current.alt ?? product.title} fill priority sizes="(max-width: 768px) 100vw, 680px" className="object-cover" />}
        {pct > 0 && (
          <span className="absolute left-3 top-3 grid size-11 place-items-center rounded-full bg-accent-500 text-center text-[11px] font-bold leading-tight text-white">
            {pct}%<br />OFF
          </span>
        )}
        <WishlistButton product={product} />
      </div>
    </div>
  );
}

// ───────────────────────── Purchase state ─────────────────────────

interface Purchase {
  variant: VariantView | null;
  selection: Record<string, string>;
  select: (key: string, value: string) => void;
  qty: number;
  setQty: (q: number) => void;
  price: number;
  compareAt: number | null;
  stock: number;
  adding: boolean;
  buy: (now: boolean) => Promise<void>;
}

function usePurchase(product: ProductDetail): Purchase {
  const { t } = useI18n();
  const router = useRouter();
  const initial = product.variants.find((v) => v.stock > 0) ?? product.variants[0] ?? null;
  const [selection, setSelection] = useState<Record<string, string>>(initial?.attributes ?? {});
  const [qty, setQty] = useState(1);
  const { add, isLoading } = useAddToCart();
  const variant = findVariant(product.variants, selection);
  const price = variant ? (variant.flash?.specialPrice ?? variant.price) : product.price;
  const compareAt = variant ? (variant.flash ? variant.price : variant.compareAtPrice) : product.compareAtPrice;
  return {
    variant,
    selection,
    select: (key, value) => {
      setSelection((s) => ({ ...s, [key]: value }));
      setQty(1);
    },
    qty,
    setQty,
    price,
    compareAt,
    stock: variant?.stock ?? 0,
    adding: isLoading,
    buy: async (now) => {
      if (!variant) {
        toast.error(fill(t.product.selectOption, { name: Object.keys(product.options)[0] ?? '' }));
        return;
      }
      const ok = await add(product, variant, qty);
      if (!ok) toast.error(t.common.error);
      else if (now) router.push('/cart');
      else toast.success(t.product.added);
    },
  };
}

/** Option tiles: shows the variant's own image when it has one, otherwise a text chip. */
function OptionPicker({ product, purchase, compact = false }: { product: ProductDetail; purchase: Purchase; compact?: boolean }) {
  const available = (key: string, value: string) =>
    product.variants.some(
      (v) => v.attributes[key] === value && v.stock > 0 && Object.entries(purchase.selection).every(([k, val]) => k === key || v.attributes[k] === val),
    );
  return (
    <>
      {Object.entries(product.options).map(([key, values]) => (
        <div key={key}>
          <p className="mb-1.5 text-xs text-ink-500">
            <span className="capitalize">{key}</span>: <span className="font-semibold text-ink-900">{purchase.selection[key] ?? '—'}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {values.map((value) => {
              const selected = purchase.selection[key] === value;
              const variant = product.variants.find((v) => v.attributes[key] === value);
              const image = product.images.find((i) => i.variantId && i.variantId === variant?.id);
              const ok = available(key, value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => purchase.select(key, value)}
                  title={value}
                  className={cn(
                    'rounded-md border text-xs transition',
                    image && !compact ? 'flex size-16 flex-col items-center justify-center gap-0.5 p-1' : 'min-w-10 px-2.5 py-1.5',
                    selected ? 'border-primary-700 bg-primary-50 font-semibold text-primary-800 ring-1 ring-primary-700' : 'border-ink-200 hover:border-ink-400',
                    !ok && 'text-ink-300 line-through',
                  )}
                >
                  {image && !compact ? (
                    <>
                      <Image src={image.url} alt="" width={40} height={40} className="size-10 rounded object-cover" />
                      <span className="truncate text-[10px]">{value}</span>
                    </>
                  ) : (
                    value
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

// ───────────────────────── Info column ─────────────────────────

function InfoRow({ icon, title, sub }: { icon: ReactNode; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-ink-100 py-2.5 last:border-0">
      <span className="text-primary-700">{icon}</span>
      <span className="flex-1 text-[13px]">
        <span className="font-semibold text-ink-800">{title}</span>
        {sub && <span className="ml-1.5 text-ink-500">{sub}</span>}
      </span>
      <ChevronRight className="size-4 text-ink-300" />
    </div>
  );
}

function Vouchers() {
  const { money } = useI18n();
  const { data: coupons } = useAvailableCouponsQuery();
  if (!coupons?.length) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1 text-sm font-semibold">
        Vouchers <ChevronRight className="size-4" />
      </p>
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {coupons.map((c) => (
          <div key={c.id} className="w-60 shrink-0 rounded-lg border border-dashed border-accent-300 bg-accent-50 p-2.5">
            <div className="flex items-start gap-2">
              <Ticket className="mt-0.5 size-5 shrink-0 text-accent-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-ink-600">{c.description ?? c.code}</p>
                <p className="text-base font-bold text-accent-700">
                  {c.type === 'PERCENTAGE' ? `${c.value}% off` : `${money(c.value)} off`}
                </p>
                <p className="text-[10px] text-ink-500">Min. spend {money(c.minOrderAmount)}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-dashed border-accent-200 pt-2">
              <span className="text-[10px] text-ink-400">Until {new Date(c.endsAt).toLocaleDateString('en-GB')}</span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(c.code);
                  toast.success(`Code ${c.code} copied — apply it at checkout`);
                }}
                className="rounded-full bg-accent-500 px-3 py-0.5 text-[11px] font-semibold text-white hover:bg-accent-600"
              >
                Copy code
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductInfo({ product, purchase }: { product: ProductDetail; purchase: Purchase }) {
  const { t, money, pick } = useI18n();
  const { showSellerInfo } = useMarketplaceMode(product.seller !== null);
  const { data: settingsData } = usePublicSettingsQuery();
  const settings = useHydrated() ? settingsData : undefined;
  const { variant, price, compareAt, stock } = purchase;
  const pct = discountPercent(price, compareAt);

  return (
    <div className="space-y-4">
      {variant?.flash && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gradient-to-r from-flash to-accent-500 px-3 py-2 text-white">
          <span className="flex items-center gap-1 font-bold">
            <Zap className="size-4 fill-white" /> {t.home.flashSale}
          </span>
          <span className="flex items-center gap-2 text-xs">
            {variant.flash.soldCount} {t.common.sold} · {t.home.endsIn} <Countdown endsAt={variant.flash.endsAt} compact />
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        {product.brand && (
          <Link href={`/search?brand=${product.brand.slug}`} className="text-sm font-semibold text-primary-700 hover:underline">
            {product.brand.name}
          </Link>
        )}
        <h1 className="text-lg font-semibold leading-snug text-ink-900 md:text-xl">
            {showSellerInfo && product.seller && (
              <span className="mr-1.5 inline-flex -translate-y-0.5 items-center gap-0.5 rounded bg-primary-50 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase text-primary-700">
                <BadgeCheck className="size-3" /> {product.seller.isHouseStore ? 'Official' : 'Verified'}
              </span>
            )}
            {pick(product.title, product.titleBn)}
          </h1>
        <a href="#reviews" className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold">{product.ratingAvg.toFixed(1)}</span>
          <Stars value={product.ratingAvg} />
          <span className="text-primary-700">({product.ratingCount} reviews)</span>
          <span className="text-ink-400">· {product.soldCount.toLocaleString()} {t.common.sold}</span>
        </a>
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        {pct > 0 && (
          <span className="flex items-center text-sm font-semibold text-success">
            <ArrowDown className="size-3.5" />
            {pct}%
          </span>
        )}
        {compareAt && compareAt > price && <span className="text-sm text-ink-400 line-through">{money(compareAt)}</span>}
        <span className="text-3xl font-bold text-accent-600">{money(price)}</span>
      </div>

      <OptionPicker product={product} purchase={purchase} />

      <div>
        <p className="mb-1.5 text-xs text-ink-500">{t.product.quantity}</p>
        <div className="flex items-center gap-3">
          <QuantityStepper value={purchase.qty} max={Math.max(1, Math.min(stock, 20))} onChange={purchase.setQty} disabled={stock === 0} />
          <span className={cn('text-xs', stock === 0 ? 'text-danger' : stock <= 5 ? 'font-semibold text-flash' : 'text-ink-500')}>
            {stock === 0 ? t.common.outOfStock : stock <= 5 ? fill(t.product.onlyLeft, { n: stock }) : t.common.inStock}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-ink-100 px-3">
        {settings && (
          <InfoRow
            icon={<Truck className="size-4" />}
            title={`Standard Delivery ${money(settings.shipping.insideDhaka)}`}
            sub={`Inside Dhaka ${settings.shipping.insideDhakaEta} · Outside Dhaka ${money(settings.shipping.outsideDhaka)}, ${settings.shipping.outsideDhakaEta}`}
          />
        )}
        {settings && (
          <InfoRow
            icon={<RotateCcw className="size-4" />}
            title={settings.returns.days > 0 ? `${settings.returns.days} Days Returns` : 'No returns'}
            sub={t.product.cod}
          />
        )}
        <InfoRow icon={<ShieldCheck className="size-4" />} title={product.warranty ?? 'No warranty'} />
      </div>

      <Vouchers />

      <div className="hidden gap-3 md:flex">
        <Button size="lg" variant="accent" className="flex-1" disabled={stock === 0} loading={purchase.adding} onClick={() => void purchase.buy(true)}>
          {t.product.buyNow}
        </Button>
        <Button size="lg" className="flex-1" disabled={stock === 0} loading={purchase.adding} onClick={() => void purchase.buy(false)}>
          {t.product.addToCart}
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── Sections ─────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Product Details' },
  { id: 'specs', label: 'Specifications' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'questions', label: 'Questions' },
  { id: 'seller', label: 'Seller' },
  { id: 'recommended', label: 'Recommended' },
];

/** Id of the section currently under the sticky header (scroll-spy for the tab row). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');
  const key = ids.join(',');
  useEffect(() => {
    const sections = key
      .split(',')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;
    const onScroll = () => {
      // The last section whose top has passed the sticky header + tab row wins.
      let current = sections[0]!.id;
      for (const el of sections) if (el.getBoundingClientRect().top <= 200) current = el.id;
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [key]);
  return active;
}

/** Section whose body collapses to a preview with a "See more" button. */
function Collapsible({ children, height = 220 }: { children: ReactNode; height?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className={cn('relative overflow-hidden', !open && 'max-h-[var(--h)]')} style={{ ['--h' as string]: `${height}px` }}>
        {children}
        {!open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white" />}
      </div>
      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-4 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-200"
        >
          {open ? 'See less' : 'See more'} <ChevronDown className={cn('size-3.5 transition', open && 'rotate-180')} />
        </button>
      </div>
    </div>
  );
}

/** Small sticky buy box shown beside the long content on desktop. */
function StickyBuyBox({ product, purchase }: { product: ProductDetail; purchase: Purchase }) {
  const { t, money, pick } = useI18n();
  const { stock } = purchase;
  return (
    <div className="card sticky top-44 space-y-4 p-5">
      <div className="flex gap-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-ink-50">
          {product.images[0] && <Image src={product.images[0].url} alt="" fill sizes="80px" className="object-cover" />}
        </div>
        <p className="line-clamp-3 text-sm text-ink-700">{pick(product.title, product.titleBn)}</p>
      </div>
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-accent-600">{money(purchase.price)}</span>
        {purchase.compareAt && purchase.compareAt > purchase.price && (
          <span className="text-sm text-ink-400 line-through">{money(purchase.compareAt)}</span>
        )}
      </p>
      <OptionPicker product={product} purchase={purchase} compact />
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-500">{t.product.quantity}</span>
        <QuantityStepper value={purchase.qty} max={Math.max(1, Math.min(stock, 20))} onChange={purchase.setQty} disabled={stock === 0} />
      </div>
      <div className="flex gap-2">
        <Button variant="accent" className="flex-1" disabled={stock === 0} loading={purchase.adding} onClick={() => void purchase.buy(true)}>
          {t.product.buyNow}
        </Button>
        <Button className="flex-1" disabled={stock === 0} loading={purchase.adding} onClick={() => void purchase.buy(false)}>
          {t.product.addToCart}
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── Page ─────────────────────────

export function ProductView({ product }: { product: ProductDetail }) {
  const { t, pick } = useI18n();
  const { showSellerInfo } = useMarketplaceMode(product.seller !== null);
  const purchase = usePurchase(product);
  const { data: related } = useRelatedProductsQuery(product.slug);
  const { data: boughtTogether } = useBoughtTogetherQuery(product.slug);
  const { data: sellerProducts } = useProductsQuery(
    { seller: product.seller?.slug, limit: 12, sort: 'popular' },
    { skip: !showSellerInfo || !product.seller },
  );
  const description = pick(product.description, product.descriptionBn);
  const [lead, ...rest] = description.split(/\n+/);
  const optionKeys = Object.keys(product.options);
  const tabs = TABS.filter((tab) => tab.id !== 'seller' || (showSellerInfo && product.seller));
  const activeTab = useActiveSection(tabs.map((tab) => tab.id));
  useEffect(() => rememberViewed(product), [product]);

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div id="overview" className="card grid scroll-mt-48 gap-6 p-4 md:grid-cols-2 md:p-5 lg:grid-cols-[minmax(0,1fr)_520px]">
        <Gallery product={product} variantId={purchase.variant?.id ?? null} />
        <ProductInfo product={product} purchase={purchase} />
      </div>

      <nav className="scrollbar-none sticky top-[7.5rem] z-10 -mx-3 flex gap-7 overflow-x-auto border-b border-ink-200 bg-canvas px-3 text-sm md:top-[6.5rem] md:mx-0 md:px-1">
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            aria-current={activeTab === tab.id ? 'true' : undefined}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 py-3 transition-colors',
              activeTab === tab.id ? 'border-primary-700 font-semibold text-primary-700' : 'border-transparent text-ink-600 hover:text-primary-700',
            )}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <section id="details" className="card scroll-mt-48 p-5">
            <h2 className="mb-3 font-semibold text-ink-900">Product Details</h2>
            {product.highlights.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-semibold">Key features</h3>
                <ul className="space-y-1.5 text-sm text-ink-700">
                  {product.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary-600" /> {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Collapsible>
              <h3 className="mb-2 font-semibold">{pick(product.title, product.titleBn)}</h3>
              <p className="text-sm leading-relaxed text-ink-700">{lead}</p>
              {rest.map((para) => (
                <p key={para} className="mt-2 text-sm leading-relaxed text-ink-700">
                  {para}
                </p>
              ))}
            </Collapsible>
          </section>

          <section id="specs" className="card scroll-mt-48 p-5">
            <h2 className="mb-3 font-semibold text-ink-900">Specifications</h2>
            <dl className="divide-y divide-ink-100 rounded-lg border border-ink-100 text-sm">
              {product.brand && (
                <div className="grid grid-cols-[160px_1fr] px-3 py-2"><dt className="text-ink-500">{t.product.brand}</dt><dd>{product.brand.name}</dd></div>
              )}
              <div className="grid grid-cols-[160px_1fr] px-3 py-2">
                <dt className="text-ink-500">{t.product.category}</dt>
                <dd>
                  <Link href={`/c/${product.category.slug}`} className="text-primary-700 hover:underline">
                    {pick(product.category.name, product.category.nameBn)}
                  </Link>
                </dd>
              </div>
              <div className="grid grid-cols-[160px_1fr] px-3 py-2"><dt className="text-ink-500">{t.product.sku}</dt><dd>{purchase.variant?.sku ?? product.variants[0]?.sku}</dd></div>
              {optionKeys.map((k) => (
                <div key={k} className="grid grid-cols-[160px_1fr] px-3 py-2">
                  <dt className="capitalize text-ink-500">{k}</dt>
                  <dd>{product.options[k]!.join(', ')}</dd>
                </div>
              ))}
              {product.specifications.map((row) => (
                <div key={row.label} className="grid grid-cols-[160px_1fr] px-3 py-2">
                  <dt className="text-ink-500">{row.label}</dt>
                  <dd className="whitespace-pre-line">{row.value}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[160px_1fr] px-3 py-2">
                <dt className="text-ink-500">Warranty</dt>
                <dd>{product.warranty ?? 'No warranty'}</dd>
              </div>
            </dl>
          </section>

          <ProductReviews productId={product.id} />

          <ProductQuestions productId={product.id} />

          {showSellerInfo && product.seller && (
            <section id="seller" className="card flex scroll-mt-48 flex-wrap items-center gap-3 p-4">
              <div className="relative size-12 overflow-hidden rounded-lg bg-ink-50">
                {product.seller.logoUrl && <Image src={product.seller.logoUrl} alt="" fill sizes="48px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-semibold">
                  {product.seller.shopName}
                  {product.seller.isHouseStore && <BadgeCheck className="size-4 text-primary-600" />}
                </p>
                {product.seller.ratingAvg > 0 && (
                  <p className="flex items-center gap-1 text-xs text-ink-500">
                    <Star className="size-3 fill-warning text-warning" /> {product.seller.ratingAvg.toFixed(1)} seller rating
                  </p>
                )}
              </div>
              <Link
                href={`/shop/${product.seller.slug}`}
                className="flex items-center gap-1 rounded-md bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-700 hover:bg-accent-100"
              >
                <Store className="size-3.5" /> {t.common.visitStore} <ChevronRight className="size-3.5" />
              </Link>
            </section>
          )}

          <div id="recommended" className="scroll-mt-48 space-y-5">
            <ProductRow title="Frequently bought together" products={boughtTogether ?? []} />
            {showSellerInfo && (
              <ProductRow title="More from this Seller" products={(sellerProducts?.items ?? []).filter((p) => p.id !== product.id)} />
            )}
            <ProductRow title="Similar items" products={related ?? []} />
          </div>
        </div>

        <aside className="hidden lg:block">
          <StickyBuyBox product={product} purchase={purchase} />
        </aside>
      </div>

      <DealsFeed />

      {/* Mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-ink-100 bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        <Button variant="accent" className="flex-1" disabled={purchase.stock === 0} loading={purchase.adding} onClick={() => void purchase.buy(true)}>
          {t.product.buyNow}
        </Button>
        <Button className="flex-1" disabled={purchase.stock === 0} loading={purchase.adding} onClick={() => void purchase.buy(false)}>
          {t.product.addToCart}
        </Button>
      </div>
    </div>
  );
}
