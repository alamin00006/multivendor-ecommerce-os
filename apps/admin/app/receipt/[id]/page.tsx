'use client';

import { PosReceiptPage } from '@marketbd/ui';

/** Printable receipt for a counter sale: /receipt/:orderId (?print=1 opens the print dialog). */
export default function ReceiptPage() {
  return <PosReceiptPage scope="admin" backHref="/pos" />;
}
