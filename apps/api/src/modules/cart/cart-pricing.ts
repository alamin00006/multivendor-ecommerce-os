import type { CartItemView, CartView, SellerSummary } from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { asAttributes } from '../../common/utils.js';
import { type FlashMap, sellerSummarySelect, toSellerSummary } from '../products/product.mapper.js';

export const cartLineInclude = {
  variant: {
    include: {
      product: {
        include: {
          seller: { select: sellerSummarySelect },
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

export type CartLine = Prisma.CartItemGetPayload<{ include: typeof cartLineInclude }>;

export interface PricingContext {
  flash: FlashMap;
  multiVendor: boolean;
}

/** Why a line cannot be bought right now, or null when it can. */
export const unavailableReason = (line: CartLine, ctx: PricingContext): string | null => {
  const { variant } = line;
  const { product } = variant;
  const sellerVisible = ctx.multiVendor ? product.seller.status === 'APPROVED' : product.seller.isHouseStore;
  if (product.status !== 'ACTIVE' || !variant.isActive || !sellerVisible) return 'This item is no longer available';
  if (variant.stock <= 0) return 'Out of stock';
  if (variant.stock < line.quantity) return `Only ${variant.stock} left in stock`;
  return null;
};

/** Unit price for a line: flash price if the sale has enough stock left for the whole quantity. */
export const linePrice = (line: CartLine, ctx: PricingContext): { unitPrice: number; isFlashPrice: boolean } => {
  const flash = ctx.flash.get(line.variantId);
  if (flash && flash.stockLimit - flash.soldCount >= line.quantity) {
    return { unitPrice: flash.specialPrice, isFlashPrice: true };
  }
  return { unitPrice: line.variant.price, isFlashPrice: false };
};

export const toCartItemView = (line: CartLine, ctx: PricingContext): CartItemView => {
  const reason = unavailableReason(line, ctx);
  const { unitPrice, isFlashPrice } = linePrice(line, ctx);
  const { variant } = line;
  const seller: SellerSummary | null = ctx.multiVendor ? toSellerSummary(variant.product.seller) : null;
  const compareAt = isFlashPrice ? (variant.compareAtPrice ?? variant.price) : variant.compareAtPrice;
  return {
    id: line.id,
    variantId: line.variantId,
    quantity: line.quantity,
    selected: line.selected,
    available: reason === null,
    unavailableReason: reason,
    unitPrice,
    compareAtPrice: compareAt && compareAt > unitPrice ? compareAt : null,
    lineTotal: unitPrice * line.quantity,
    isFlashPrice,
    product: {
      id: variant.product.id,
      slug: variant.product.slug,
      title: variant.product.title,
      titleBn: variant.product.titleBn,
      imageUrl: variant.product.images[0]?.url ?? null,
    },
    variant: { sku: variant.sku, attributes: asAttributes(variant.attributes), stock: variant.stock },
    seller,
  };
};

export const buildCartView = (lines: CartLine[], ctx: PricingContext): CartView => {
  const items = lines.map((l) => toCartItemView(l, ctx));
  const payable = items.filter((i) => i.selected && i.available);
  return {
    items,
    summary: {
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      selectedCount: payable.reduce((n, i) => n + i.quantity, 0),
      unavailableCount: items.filter((i) => !i.available).length,
      subtotal: payable.reduce((sum, i) => sum + i.lineTotal, 0),
    },
  };
};
