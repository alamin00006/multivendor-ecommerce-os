'use client';

import { PageHeader, SellerDocumentsManager } from '@marketbd/ui';

/** Seller Center → Verification: identity and business documents for the "Verified seller" badge. */
export default function SellerDocumentsPage() {
  return (
    <div>
      <PageHeader title="Verification" description="Documents our team checks before your shop gets the Verified seller badge." />
      <div className="card p-4 sm:p-6">
        <SellerDocumentsManager />
      </div>
    </div>
  );
}
