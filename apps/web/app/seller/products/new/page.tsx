'use client';

import { PageHeader } from '@/components/manage/panel';
import { ProductForm } from '@/components/manage/product-form';

export default function NewSellerProductPage() {
  return (
    <div>
      <PageHeader title="Add product" />
      <ProductForm scope="seller" />
    </div>
  );
}
