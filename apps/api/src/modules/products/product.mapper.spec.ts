import { describe, expect, it } from 'vitest';
import type { FlashPrice } from '@marketbd/shared';
import { collectOptions, type ProductForCard, toProductCard } from './product.mapper.js';

const decimal = (n: number) => ({ toNumber: () => n });

const product = (variants: Array<{ id: string; price: number; compareAtPrice: number | null; stock: number }>) =>
  ({
    id: 'p1',
    slug: 'p1',
    title: 'Phone',
    titleBn: null,
    minPrice: 0,
    ratingAvg: decimal(4.2),
    ratingCount: 10,
    soldCount: 50,
    images: [{ url: 'https://img/1.jpg' }],
    seller: { id: 's1', shopName: 'Shop', slug: 'shop', logoUrl: null, ratingAvg: decimal(4), isHouseStore: false, status: 'APPROVED' },
    variants: variants.map((v) => ({ ...v, attributes: {}, isActive: true })),
  }) as unknown as ProductForCard;

describe('toProductCard', () => {
  it('shows the cheapest variant with its discount', () => {
    const card = toProductCard(
      product([
        { id: 'a', price: 200_000, compareAtPrice: 250_000, stock: 5 },
        { id: 'b', price: 150_000, compareAtPrice: 200_000, stock: 5 },
      ]),
      new Map(),
      true,
    );
    expect(card.price).toBe(150_000);
    expect(card.discountPercent).toBe(25);
    expect(card.seller?.shopName).toBe('Shop');
  });

  it('applies an active flash price and hides the seller in single-vendor mode', () => {
    const flash: FlashPrice = { flashSaleId: 'f', specialPrice: 100_000, stockLimit: 10, soldCount: 2, endsAt: '2099-01-01T00:00:00Z' };
    const card = toProductCard(
      product([{ id: 'a', price: 150_000, compareAtPrice: null, stock: 5 }]),
      new Map([['a', flash]]),
      false,
    );
    expect(card.price).toBe(100_000);
    expect(card.compareAtPrice).toBe(150_000);
    expect(card.flash).not.toBeNull();
    expect(card.seller).toBeNull();
  });
});

describe('collectOptions', () => {
  it('collects unique option values in order', () => {
    expect(
      collectOptions([
        { attributes: { color: 'Black', size: 'M' } },
        { attributes: { color: 'Blue', size: 'M' } },
        { attributes: { color: 'Black', size: 'L' } },
      ]),
    ).toEqual({ color: ['Black', 'Blue'], size: ['M', 'L'] });
  });
});
