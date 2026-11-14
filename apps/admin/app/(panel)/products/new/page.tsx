'use client';

import { PageHeader, ProductForm } from '@marketbd/ui';

export default function NewAdminProductPage() {
  return (
    <div>
      <PageHeader title="Add product" description="New products are added to the house store." />
      <ProductForm scope="admin" />
    </div>
  );
}
