'use client';

import { PosTerminal } from '@marketbd/ui';

/** Seller Center → POS: sell your shop's stock to walk-in customers. Cash only for now. */
export default function SellerPosPage() {
  return (
    <PosTerminal
      scope="seller"
      salesHref="/seller/orders"
      description="Sell your shop’s stock at your own counter. Payment: cash only. The marketplace commission is taken from your balance."
    />
  );
}
