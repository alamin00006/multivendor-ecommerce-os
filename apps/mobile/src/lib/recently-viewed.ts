import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProductCard } from '@marketbd/shared';
import { useEffect, useState } from 'react';

// Device-local convenience list; failures are ignored because the list is optional.
const KEY = 'mbd_recent';
const MAX = 20;
const listeners = new Set<() => void>();

async function read(): Promise<ProductCard[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProductCard[]) : [];
  } catch {
    return [];
  }
}

/** Remembers a viewed product (card fields only), newest first. */
export async function rememberViewed(p: ProductCard) {
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
    const next = [card, ...(await read()).filter((x) => x.id !== p.id)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((fn) => fn());
  } catch {
    // ignore — the list is optional
  }
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<ProductCard[]>([]);
  useEffect(() => {
    const load = () => void read().then(setItems);
    load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, []);
  return items;
}
