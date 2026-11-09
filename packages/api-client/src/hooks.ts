import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { ProductCard, VariantView } from '@marketbd/shared';
import { selectIsAuthenticated, type RootStateWithAuth } from './auth-slice.js';
import { errorMessage } from './base-api.js';
import { usePublicSettingsQuery } from './endpoints/auth.js';
import {
  useAddToCartMutation,
  useCartQuery,
  useMergeCartMutation,
  useWishlistIdsQuery,
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation,
} from './endpoints/account.js';
import {
  guestCartCleared,
  guestItemAdded,
  type GuestCartItem,
  selectGuestCart,
  type RootStateWithGuestCart,
} from './guest-cart-slice.js';

/**
 * Marketplace mode (multi-vendor ON/OFF). Every mode-dependent UI decision reads this hook.
 * While loading, `multiVendor` keeps the last known value (default true) to avoid layout flicker.
 */
export const useMarketplaceMode = (initial?: boolean) => {
  const { data, isLoading, isFetching } = usePublicSettingsQuery(undefined, { pollingInterval: 5 * 60_000 });
  const multiVendor = data?.multiVendorEnabled ?? initial ?? true;
  return {
    multiVendor,
    singleVendor: !multiVendor,
    /** Show seller names, shop links, "Sold by" blocks and seller ratings. */
    showSellerInfo: multiVendor,
    /** Seller registration and the /seller panel are reachable. */
    sellerFeatures: multiVendor,
    isLoading,
    isFetching,
  };
};

export const useIsAuthenticated = () => useSelector((s: RootStateWithAuth) => selectIsAuthenticated(s));

export const variantLabelOf = (variant: Pick<VariantView, 'attributes'>) => {
  const values = Object.values(variant.attributes);
  return values.length ? values.join(' / ') : 'Default';
};

/**
 * Add-to-cart that works for guests (local cart) and signed-in users (server cart).
 */
export const useAddToCart = () => {
  const dispatch = useDispatch();
  const authed = useIsAuthenticated();
  const [addServer, state] = useAddToCartMutation();
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (
      product: Pick<ProductCard, 'id' | 'slug' | 'title' | 'titleBn' | 'imageUrl'>,
      variant: VariantView,
      quantity = 1,
    ): Promise<boolean> => {
      setError(null);
      if (authed) {
        try {
          await addServer({ variantId: variant.id, quantity }).unwrap();
          return true;
        } catch (e) {
          setError(errorMessage(e));
          return false;
        }
      }
      const item: GuestCartItem = {
        variantId: variant.id,
        quantity,
        productId: product.id,
        slug: product.slug,
        title: product.title,
        titleBn: product.titleBn,
        imageUrl: product.imageUrl,
        unitPrice: variant.flash?.specialPrice ?? variant.price,
        compareAtPrice: variant.flash ? variant.price : variant.compareAtPrice,
        variantLabel: variantLabelOf(variant),
        stock: variant.stock,
        selected: true,
      };
      dispatch(guestItemAdded(item));
      return true;
    },
    [authed, addServer, dispatch],
  );

  return { add, isLoading: state.isLoading, error };
};

/** Total quantity in the cart, for header/tab badges. */
export const useCartCount = () => {
  const authed = useIsAuthenticated();
  const guest = useSelector((s: RootStateWithGuestCart) => selectGuestCart(s));
  const { data } = useCartQuery(undefined, { skip: !authed });
  return authed ? (data?.summary.itemCount ?? 0) : guest.reduce((n, i) => n + i.quantity, 0);
};

/** Merges the guest cart into the server cart once, right after sign-in. */
export const useGuestCartMerge = () => {
  const dispatch = useDispatch();
  const authed = useIsAuthenticated();
  const guest = useSelector((s: RootStateWithGuestCart) => selectGuestCart(s));
  const [merge] = useMergeCartMutation();
  const merging = useRef(false);

  useEffect(() => {
    if (!authed || guest.length === 0 || merging.current) return;
    merging.current = true;
    merge({ items: guest.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) })
      .unwrap()
      .then(() => dispatch(guestCartCleared()))
      .catch(() => undefined)
      .finally(() => {
        merging.current = false;
      });
  }, [authed, guest, merge, dispatch]);
};

/** Wishlist toggle for a product card or detail page. */
export const useWishlistToggle = (productId: string) => {
  const authed = useIsAuthenticated();
  const { data: ids } = useWishlistIdsQuery(undefined, { skip: !authed });
  const [add, addState] = useAddToWishlistMutation();
  const [remove, removeState] = useRemoveFromWishlistMutation();
  const saved = Boolean(ids?.includes(productId));
  const toggle = useCallback(async () => {
    if (!authed) return false;
    if (saved) await remove(productId).unwrap();
    else await add(productId).unwrap();
    return true;
  }, [authed, saved, add, remove, productId]);
  return { saved, toggle, authed, isLoading: addState.isLoading || removeState.isLoading };
};

/** Live countdown to an ISO date; returns zeros once reached. */
export const useCountdown = (endsAt: string | null | undefined) => {
  const target = endsAt ? new Date(endsAt).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    done: diff === 0,
  };
};
