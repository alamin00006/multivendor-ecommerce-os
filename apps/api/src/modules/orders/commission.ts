import type { Prisma } from '../../generated/prisma/client.js';
import { num } from '../../common/utils.js';

type Db = Pick<Prisma.TransactionClient, 'product' | 'category'>;

/**
 * Commission for one shop's package. Each item uses its category's rate (or the nearest parent
 * category with a rate); items in categories without one use the shop's rate. `base` is what
 * commission is charged on (item value after item discounts), spread over items by value.
 * Returns the amount (poisha) and the effective rate stored on the package.
 */
export async function commissionFor(
  db: Db,
  shopRate: number,
  lines: Array<{ productId: string; amount: number }>,
  base: number,
): Promise<{ rate: number; amount: number }> {
  const products = await db.product.findMany({ where: { id: { in: [...new Set(lines.map((l) => l.productId))] } }, select: { id: true, categoryId: true } });
  const categoryOf = new Map(products.map((p) => [p.id, p.categoryId]));
  const categories = await db.category.findMany({ select: { id: true, parentId: true, commissionRate: true } });
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rateOf = (categoryId: string | undefined): number => {
    for (let c = categoryId ? byId.get(categoryId) : undefined, depth = 0; c && depth < 10; c = c.parentId ? byId.get(c.parentId) : undefined, depth++) {
      if (c.commissionRate !== null) return num(c.commissionRate);
    }
    return shopRate;
  };

  const rates = lines.map((l) => rateOf(categoryOf.get(l.productId)));
  const itemsTotal = lines.reduce((s, l) => s + l.amount, 0);
  if (!itemsTotal || base <= 0) return { rate: rates[0] ?? shopRate, amount: 0 };
  const weighted = lines.reduce((s, l, i) => s + (l.amount * (rates[i] ?? shopRate)) / 100, 0);
  const amount = Math.round((weighted * base) / itemsTotal);
  const single = rates.every((r) => r === rates[0]);
  return { rate: single ? (rates[0] ?? shopRate) : Math.round((amount / base) * 10_000) / 100, amount };
}
