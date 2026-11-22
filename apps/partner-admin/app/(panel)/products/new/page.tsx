'use client';

import { PageHeader, ProductForm } from '@marketbd/ui';

export default function NewSellerProductPage() {
  return (
    <div>
      <PageHeader title="Add product" />
      <ProductForm scope="seller" />
    </div>
  );
}
