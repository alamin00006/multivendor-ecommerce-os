import { describe, expect, it } from 'vitest';
import type { FlashPrice } from '@marketbd/shared';
import { buildCartView, type CartLine, type PricingContext } from './cart-pricing.js';

const decimal = (n: number) => ({ toNumber: () => n });

const line = (overrides: {
  id?: string;
  quantity?: number;
  stock?: number;
  price?: number;
  selected?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  houseStore?: boolean;
  sellerStatus?: 'APPROVED' | 'SUSPENDED';
}): CartLine =>
  ({
    id: overrides.id ?? 'ci1',
    cartId: 'c1',
    variantId: `v-${overrides.id ?? 'ci1'}`,
    quantity: overrides.quantity ?? 1,
    selected: overrides.selected ?? true,
    addedAt: new Date(),
    variant: {
      id: `v-${overrides.id ?? 'ci1'}`,
      productId: 'p1',
      sku: 'SKU-1',
      attributes: { color: 'Black' },
      price: overrides.price ?? 100_000,
      compareAtPrice: 120_000,
      stock: overrides.stock ?? 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      product: {
        id: 'p1',
        slug: 'p1',
        title: 'Product',
        titleBn: null,
        status: overrides.status ?? 'ACTIVE',
        images: [],
        seller: {
          id: 's1',
          shopName: 'Shop',
          slug: 'shop',
          logoUrl: null,
          ratingAvg: decimal(4.5),
          isHouseStore: overrides.houseStore ?? false,
          status: overrides.sellerStatus ?? 'APPROVED',
        },
      },
    },
  }) as unknown as CartLine;

const ctx = (flash: Array<[string, FlashPrice]> = [], multiVendor = true): PricingContext => ({
  flash: new Map(flash),
  multiVendor,
});

const flash = (soldCount: number, stockLimit = 10): FlashPrice => ({
  flashSaleId: 'fs1',
  specialPrice: 70_000,
  stockLimit,
  soldCount,
  endsAt: new Date(Date.now() + 3600_000).toISOString(),
});

describe('cart pricing', () => {
  it('sums only selected, available lines', () => {
    const view = buildCartView(
      [line({ id: 'a', quantity: 2 }), line({ id: 'b', selected: false }), line({ id: 'c', stock: 0 })],
      ctx(),
    );
    expect(view.summary.subtotal).toBe(200_000);
    expect(view.summary.unavailableCount).toBe(1);
    expect(view.items.find((i) => i.id === 'c')?.unavailableReason).toBe('Out of stock');
  });

  it('uses the flash price while the sale has enough stock for the whole quantity', () => {
    const view = buildCartView([line({ id: 'a', quantity: 2 })], ctx([['v-a', flash(5)]]));
    expect(view.items[0]?.unitPrice).toBe(70_000);
    expect(view.items[0]?.isFlashPrice).toBe(true);

    const soldOut = buildCartView([line({ id: 'a', quantity: 2 })], ctx([['v-a', flash(9)]]));
    expect(soldOut.items[0]?.unitPrice).toBe(100_000);
  });

  it('marks third-party seller items unavailable in single-vendor mode', () => {
    const view = buildCartView(
      [line({ id: 'a' }), line({ id: 'b', houseStore: true })],
      ctx([], false),
    );
    expect(view.items.find((i) => i.id === 'a')?.available).toBe(false);
    expect(view.items.find((i) => i.id === 'b')?.available).toBe(true);
    expect(view.items.every((i) => i.seller === null)).toBe(true);
  });

  it('flags insufficient stock and inactive products', () => {
    const view = buildCartView([line({ id: 'a', quantity: 5, stock: 3 }), line({ id: 'b', status: 'INACTIVE' })], ctx());
    expect(view.items[0]?.unavailableReason).toBe('Only 3 left in stock');
    expect(view.items[1]?.available).toBe(false);
    expect(view.summary.subtotal).toBe(0);
  });
});
