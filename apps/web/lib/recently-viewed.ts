'use client';

import type { ProductCard } from '@marketbd/shared';
import { useEffect, useState } from 'react';

// Per-browser convenience list; storage can be blocked (private mode), so every access is guarded.
const KEY = 'mbd_recent';
const MAX = 20;

function read(): ProductCard[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProductCard[]) : [];
  } catch {
    return [];
  }
}

/** Remembers a viewed product (card fields only), newest first. */
export function rememberViewed(p: ProductCard) {
  const card: ProductCard = {
    id: p.id,
    slug: p.slug,
    title: p.title,
    titleBn: p.titleBn,
    imageUrl: p.imageUrl,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    discountPercent: p.discountPercent,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    soldCount: p.soldCount,
    inStock: p.inStock,
    seller: p.seller,
    flash: p.flash,
    defaultVariant: p.defaultVariant,
    variantCount: p.variantCount,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([card, ...read().filter((x) => x.id !== p.id)].slice(0, MAX)));
  } catch {
    // ignore — the list is optional
  }
}

/** Recently viewed products, read after mount so server and client HTML match. */
export function useRecentlyViewed(excludeIds: string[] = []) {
  const [items, setItems] = useState<ProductCard[]>([]);
  const exclude = excludeIds.join(',');
  useEffect(() => {
    const skip = new Set(exclude.split(',').filter(Boolean));
    setItems(read().filter((p) => !skip.has(p.id)));
  }, [exclude]);
  return items;
}
