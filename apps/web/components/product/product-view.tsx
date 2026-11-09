'use client';

import {
  useAddToCart,
  useMarketplaceMode,
  useRelatedProductsQuery,
  useWishlistToggle,
} from '@marketbd/api-client';
import { discountPercent, type ProductDetail, SHIPPING_FEES, type VariantView } from '@marketbd/shared';
import { BadgeCheck, Banknote, Heart, RotateCcw, ShieldCheck, Store, Truck, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { fill } from '@/i18n';
import { useI18n } from '@/i18n/client';
import { Button, ButtonLink, cn, QuantityStepper, SectionHeader, Stars } from '@/components/ui';
import { Countdown, ProductGrid } from './product-card';
import { ProductReviews } from './product-reviews';

function Gallery({ product, variantId }: { product: ProductDetail; variantId: string | null }) {
  const images = useMemo(() => {
    const own = product.images.filter((i) => variantId && i.variantId === variantId);
    return own.length ? [...own, ...product.images.filter((i) => i.variantId !== variantId)] : product.images;
  }, [product.images, variantId]);
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, images.length - 1)];
  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-ink-50">
        {current && (
          <Image src={current.url} alt={current.alt ?? product.title} fill priority sizes="(max-width: 768px) 100vw, 450px" className="object-cover" />
        )}
      </div>
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onMouseEnter={() => setIndex(i)}
            onClick={() => setIndex(i)}
            className={cn('relative size-16 shrink-0 overflow-hidden rounded-md border-2', i === index ? 'border-primary-600' : 'border-transparent')}
            aria-label={`Image ${i + 1}`}
          >
            <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Picks the variant matching all selected options, if any. */
const findVariant = (variants: VariantView[], selection: Record<string, string>) =>
  variants.find((v) => Object.entries(selection).every(([k, val]) => v.attributes[k] === val)) ?? null;

export function ProductView({ product }: { product: ProductDetail }) {
  const { t, money, pick } = useI18n();
  const router = useRouter();
  const { showSellerInfo } = useMarketplaceMode(product.seller !== null);
  const initialVariant = product.variants.find((v) => v.stock > 0) ?? product.variants[0] ?? null;
  const [selection, setSelection] = useState<Record<string, string>>(initialVariant?.attributes ?? {});
  const [qty, setQty] = useState(1);
  const variant = findVariant(product.variants, selection);
  const { add, isLoading } = useAddToCart();
  const wishlist = useWishlistToggle(product.id);
  const { data: related } = useRelatedProductsQuery(product.slug);

  const price = variant ? (variant.flash?.specialPrice ?? variant.price) : product.price;
  const compareAt = variant ? (variant.flash ? variant.price : variant.compareAtPrice) : product.compareAtPrice;
  const pct = discountPercent(price, compareAt);
  const stock = variant?.stock ?? 0;
  const optionKeys = Object.keys(product.options);

  /** Whether choosing `value` for `key` (keeping the other selections) leads to an in-stock variant. */
  const optionAvailable = (key: string, value: string) =>
    product.variants.some(
      (v) => v.attributes[key] === value && v.stock > 0 && Object.entries(selection).every(([k, val]) => k === key || v.attributes[k] === val),
    );

  const handleAdd = async (buyNow: boolean) => {
    if (!variant) {
      toast.error(fill(t.product.selectOption, { name: optionKeys[0] ?? '' }));
      return;
    }
    const ok = await add(product, variant, qty);
    if (!ok) {
      toast.error(t.common.error);
      return;
    }
    if (buyNow) router.push('/cart');
    else toast.success(t.product.added);
  };

  const toggleWishlist = async () => {
    if (!wishlist.authed) {
      router.push(`/login?next=/p/${product.slug}`);
      return;
    }
    await wishlist.toggle();
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="card grid gap-6 p-4 md:grid-cols-[minmax(0,420px)_1fr]">
          <Gallery product={product} variantId={variant?.id ?? null} />

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
            <div>
              {(product.brand || (showSellerInfo && product.seller)) && (
                <p className="mb-1 flex flex-wrap items-center gap-2 text-sm text-ink-500">
                  {product.brand && (
                    <span>
                      {t.product.brand}:{' '}
                      <Link href={`/search?brand=${product.brand.slug}`} className="text-primary-700 hover:underline">
                        {product.brand.name}
                      </Link>
                    </span>
                  )}
                  {showSellerInfo && product.seller?.isHouseStore && (
                    <span className="inline-flex items-center gap-1 text-primary-700">
                      <BadgeCheck className="size-4" /> Official
                    </span>
                  )}
                </p>
              )}
              <h1 className="text-xl font-semibold leading-snug text-ink-900 md:text-2xl">{pick(product.title, product.titleBn)}</h1>
              <a href="#reviews" className="mt-2 flex items-center gap-2 text-sm text-ink-500">
                <Stars value={product.ratingAvg} />
                <span className="text-primary-700">
                  {product.ratingAvg.toFixed(1)} · {product.ratingCount} {t.common.reviews}
                </span>
                <span>· {product.soldCount.toLocaleString()} {t.common.sold}</span>
              </a>
            </div>

            <div className="rounded-lg bg-ink-50 p-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold text-accent-600">{money(price)}</span>
                {compareAt && compareAt > price && (
                  <>
                    <span className="text-ink-400 line-through">{money(compareAt)}</span>
                    <span className="rounded bg-accent-500 px-1.5 py-0.5 text-xs font-bold text-white">-{pct}%</span>
                  </>
                )}
              </div>
            </div>

            {optionKeys.map((key) => (
              <div key={key}>
                <p className="mb-2 text-sm">
                  <span className="capitalize text-ink-500">{key}:</span> <span className="font-semibold">{selection[key] ?? '—'}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.options[key]!.map((value) => {
                    const selected = selection[key] === value;
                    const available = optionAvailable(key, value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setSelection((s) => ({ ...s, [key]: value }));
                          setQty(1);
                        }}
                        className={cn(
                          'min-w-12 rounded-md border px-3 py-1.5 text-sm transition',
                          selected ? 'border-primary-700 bg-primary-50 font-semibold text-primary-800' : 'border-ink-200 hover:border-ink-400',
                          !available && 'text-ink-300 line-through',
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-ink-500">{t.product.quantity}</span>
              <QuantityStepper value={qty} max={Math.max(1, Math.min(stock, 20))} onChange={setQty} disabled={stock === 0} />
              <span className={cn('text-sm', stock === 0 ? 'text-danger' : stock <= 5 ? 'font-semibold text-flash' : 'text-ink-500')}>
                {stock === 0 ? t.common.outOfStock : stock <= 5 ? fill(t.product.onlyLeft, { n: stock }) : t.common.inStock}
              </span>
            </div>

            <div className="hidden gap-3 md:flex">
              <Button size="lg" variant="accent" className="flex-1" disabled={stock === 0} loading={isLoading} onClick={() => void handleAdd(true)}>
                {t.product.buyNow}
              </Button>
              <Button size="lg" className="flex-1" disabled={stock === 0} loading={isLoading} onClick={() => void handleAdd(false)}>
                {t.product.addToCart}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => void toggleWishlist()} aria-label={t.product.saveToWishlist}>
                <Heart className={cn('size-5', wishlist.saved && 'fill-accent-500 text-accent-500')} />
              </Button>
            </div>

            <ul className="flex flex-wrap gap-x-4 gap-y-2 border-t border-ink-100 pt-3 text-xs text-ink-600">
              <li className="flex items-center gap-1.5">
                <RotateCcw className="size-4 text-primary-600" /> {t.product.returns}
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary-600" /> {t.product.warranty}
              </li>
              <li>
                {t.product.category}:{' '}
                <Link href={`/c/${product.category.slug}`} className="text-primary-700 hover:underline">
                  {pick(product.category.name, product.category.nameBn)}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-3 p-4 text-sm">
            <h2 className="font-semibold">{t.product.delivery}</h2>
            <p className="flex items-start gap-2">
              <Truck className="mt-0.5 size-4 text-primary-600" />
              <span>
                {t.product.insideDhaka}: <b>{money(SHIPPING_FEES.INSIDE_DHAKA)}</b> · 1–2 days
                <br />
                {t.product.outsideDhaka}: <b>{money(SHIPPING_FEES.OUTSIDE_DHAKA)}</b> · 3–5 days
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Banknote className="size-4 text-primary-600" /> {t.product.cod}
            </p>
          </div>
          {showSellerInfo && product.seller && (
            <div className="card space-y-3 p-4">
              <p className="text-xs text-ink-500">{t.common.soldBy}</p>
              <div className="flex items-center gap-3">
                <div className="relative size-12 overflow-hidden rounded-lg bg-ink-50">
                  {product.seller.logoUrl && <Image src={product.seller.logoUrl} alt="" fill sizes="48px" className="object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate font-semibold">
                    {product.seller.shopName}
                    {product.seller.isHouseStore && <BadgeCheck className="size-4 text-primary-600" />}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-ink-500">
                    <Stars value={product.seller.ratingAvg} size={11} /> {product.seller.ratingAvg.toFixed(1)}
                  </p>
                </div>
              </div>
              <ButtonLink href={`/shop/${product.seller.slug}`} variant="outline" size="sm" className="w-full">
                <Store className="size-4" /> {t.common.visitStore}
              </ButtonLink>
            </div>
          )}
        </aside>
      </div>

      <nav className="card sticky top-[7.5rem] z-10 flex gap-6 overflow-x-auto px-4 text-sm font-semibold md:top-24">
        <a href="#description" className="border-b-2 border-transparent py-3 hover:border-primary-700">{t.product.description}</a>
        <a href="#specs" className="border-b-2 border-transparent py-3 hover:border-primary-700">{t.product.specifications}</a>
        <a href="#reviews" className="border-b-2 border-transparent py-3 hover:border-primary-700">{t.product.ratingsReviews}</a>
      </nav>

      <section id="description" className="card scroll-mt-40 p-4">
        <h2 className="mb-3 font-semibold">{t.product.description}</h2>
        <div className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{pick(product.description, product.descriptionBn)}</div>
      </section>

      <section id="specs" className="card scroll-mt-40 p-4">
        <h2 className="mb-3 font-semibold">{t.product.specifications}</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {product.brand && (
            <div className="flex gap-2"><dt className="w-32 text-ink-500">{t.product.brand}</dt><dd>{product.brand.name}</dd></div>
          )}
          <div className="flex gap-2"><dt className="w-32 text-ink-500">{t.product.sku}</dt><dd>{variant?.sku ?? product.variants[0]?.sku}</dd></div>
          {optionKeys.map((k) => (
            <div key={k} className="flex gap-2">
              <dt className="w-32 capitalize text-ink-500">{k}</dt>
              <dd>{product.options[k]!.join(', ')}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ProductReviews productId={product.id} />

      {related && related.length > 0 && (
        <section>
          <SectionHeader title={t.product.related} />
          <ProductGrid products={related} />
        </section>
      )}

      {/* Mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-ink-100 bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        <Button variant="ghost" onClick={() => void toggleWishlist()} aria-label={t.product.saveToWishlist}>
          <Heart className={cn('size-5', wishlist.saved && 'fill-accent-500 text-accent-500')} />
        </Button>
        <Button variant="accent" className="flex-1" disabled={stock === 0} loading={isLoading} onClick={() => void handleAdd(true)}>
          {t.product.buyNow}
        </Button>
        <Button className="flex-1" disabled={stock === 0} loading={isLoading} onClick={() => void handleAdd(false)}>
          {t.product.addToCart}
        </Button>
      </div>
    </div>
  );
}
