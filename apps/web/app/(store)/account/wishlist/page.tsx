'use client';

import { useWishlistQuery } from '@marketbd/api-client';
import { Heart } from 'lucide-react';
import { useI18n, ButtonLink, EmptyState } from '@marketbd/ui';
import { ProductGrid } from '@/components/product/product-card';

export default function WishlistPage() {
  const { t } = useI18n();
  const { data, isLoading } = useWishlistQuery();
  return (
    <div className="space-y-3">
      <h1 className="font-semibold">{t.common.wishlist}</h1>
      {!isLoading && (!data || data.length === 0) ? (
        <div className="card">
          <EmptyState icon={<Heart />} title={t.account.emptyWishlist} action={<ButtonLink href="/">{t.checkout.continueShopping}</ButtonLink>} />
        </div>
      ) : (
        <ProductGrid products={(data ?? []).map((w) => w.product)} loading={isLoading} skeletons={4} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
      )}
    </div>
  );
}
