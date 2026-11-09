'use client';

import { PageHeader } from '@/components/manage/panel';
import { ProductForm } from '@/components/manage/product-form';

export default function NewAdminProductPage() {
  return (
    <div>
      <PageHeader title="Add product" description="New products are added to the house store." />
      <ProductForm scope="admin" />
    </div>
  );
}
