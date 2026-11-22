'use client';

import { PosTerminal } from '@marketbd/ui';

/** Admin → POS: sell house-store stock at the counter. Cash only for now. */
export default function PosPage() {
  return <PosTerminal scope="admin" salesHref="/orders?channel=POS" description="Sell store stock at the counter. Payment: cash only." />;
}
