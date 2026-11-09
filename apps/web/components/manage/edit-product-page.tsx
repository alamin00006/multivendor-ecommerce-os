'use client';

import { useManagedProductQuery } from '@marketbd/api-client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ErrorState, Skeleton } from '@/components/ui';
import { PageHeader } from './panel';
import { ProductForm } from './product-form';

export function EditProductPage({ scope }: { scope: 'seller' | 'admin' }) {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useManagedProductQuery({ scope, id });
  if (isError) return <ErrorState message="Product not found" onRetry={() => void refetch()} />;
  if (isLoading || !data) return <Skeleton className="h-96" />;
  return (
    <div>
      <PageHeader
        title="Edit product"
        description={data.title}
        actions={
          data.status === 'ACTIVE' ? (
            <Link href={`/p/${data.slug}`} target="_blank" className="text-sm font-semibold text-primary-700">
              View in store ↗
            </Link>
          ) : undefined
        }
      />
      <ProductForm scope={scope} product={data} />
    </div>
  );
}
