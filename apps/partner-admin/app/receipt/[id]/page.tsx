'use client';

import { PosReceiptPage } from '@marketbd/ui';

/** Printable receipt for a seller's counter sale: /receipt/:orderId (?print=1 opens the print dialog). */
export default function ReceiptPage() {
  return <PosReceiptPage scope="seller" backHref="/pos" />;
}
