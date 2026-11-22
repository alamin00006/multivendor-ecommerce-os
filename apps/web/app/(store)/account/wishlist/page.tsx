'use client';

import { errorMessage, useWishlistQuery, useWishlistToggle } from '@marketbd/api-client';
import type { ProductCard as ProductCardData } from '@marketbd/shared';
import { Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Logo } from '@marketbd/ui';
import { DealsFeed } from '@/components/home/home-sections';
import { ProductCard, ProductCardSkeleton } from '@/components/product/product-card';

const GRID = 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 xl:grid-cols-5';

/** A saved product with a remove button in the corner. */
function WishlistItem({ product }: { product: ProductCardData }) {
  const wishlist = useWishlistToggle(product.id);
  return (
    <div className="relative">
      <ProductCard product={product} />
      <button
        type="button"
        disabled={wishlist.isLoading}
        onClick={async () => {
          try {
            await wishlist.toggle();
            toast.success('Removed from your wishlist');
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/95 text-ink-600 shadow-card hover:text-danger"
        aria-label={`Remove ${product.title} from wishlist`}
      >
        {wishlist.isLoading ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
      </button>
    </div>
  );
}

/** Saved products, then the deals feed underneath — all in one panel like the reference. */
export default function WishlistPage() {
  const { data, isLoading } = useWishlistQuery();
  const items = data ?? [];

  return (
    <div className="rounded-lg bg-white p-5 shadow-card md:p-6">
      <h1 className="border-b border-ink-100 pb-4 text-2xl font-semibold text-ink-900">
        Wishlist{items.length > 0 && <span className="ml-2 text-base font-normal text-ink-500">({items.length})</span>}
      </h1>

      {isLoading ? (
        <div className={`${GRID} pt-5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-14 text-center">
          <Logo className="pointer-events-none scale-150" />
          <p className="mt-8 text-xl font-semibold text-ink-900">Your Wishlist is feeling a little empty!</p>
          <p className="mt-1.5 text-sm text-ink-600">Start adding your favorite items</p>
          <Link
            href="/"
            className="mt-4 w-full max-w-sm rounded-full bg-gradient-to-r from-primary-700 to-accent-500 py-2.5 font-semibold text-white hover:opacity-95"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className={`${GRID} pt-5`}>
          {items.map((w) => (
            <WishlistItem key={w.product.id} product={w.product} />
          ))}
        </div>
      )}

      <div className="mt-10">
        <DealsFeed cols="grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" pageSize={20} />
      </div>
    </div>
  );
}
