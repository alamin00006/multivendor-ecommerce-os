import { describe, expect, it } from 'vitest';
import { commissionFor } from './commission.js';

const db = (rates: Record<string, number | null>, parent: Record<string, string | null>, productCategory: Record<string, string>) =>
  ({
    product: { findMany: async () => Object.entries(productCategory).map(([id, categoryId]) => ({ id, categoryId })) },
    category: { findMany: async () => Object.keys(rates).map((id) => ({ id, parentId: parent[id] ?? null, commissionRate: rates[id] })) },
  }) as unknown as Parameters<typeof commissionFor>[0];

describe('commissionFor', () => {
  const tree = db({ phones: 5, mobiles: null, fashion: null, shirts: 15 }, { mobiles: 'phones', shirts: 'fashion' }, { p1: 'mobiles', p2: 'shirts', p3: 'fashion' });

  it('uses the nearest category rate, else the shop rate', async () => {
    expect(await commissionFor(tree, 10, [{ productId: 'p1', amount: 100_000 }], 100_000)).toEqual({ rate: 5, amount: 5_000 });
    expect(await commissionFor(tree, 10, [{ productId: 'p2', amount: 100_000 }], 100_000)).toEqual({ rate: 15, amount: 15_000 });
    expect(await commissionFor(tree, 10, [{ productId: 'p3', amount: 100_000 }], 100_000)).toEqual({ rate: 10, amount: 10_000 });
  });

  it('mixes rates by item value and spreads a discount', async () => {
    // 5% of 100,000 + 15% of 100,000 = 20,000 on 200,000; a 50,000 discount scales it to 15,000
    const r = await commissionFor(tree, 10, [{ productId: 'p1', amount: 100_000 }, { productId: 'p2', amount: 100_000 }], 150_000);
    expect(r).toEqual({ rate: 10, amount: 15_000 });
    expect(await commissionFor(tree, 10, [{ productId: 'p1', amount: 100_000 }], 0)).toEqual({ rate: 5, amount: 0 });
  });
});
