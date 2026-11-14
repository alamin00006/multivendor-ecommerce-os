'use client';

import { errorMessage, useAdminCampaignProductsMutation, useAdminCampaignQuery, useProductsQuery } from '@marketbd/api-client';
import { Plus, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { storeUrl, PageHeader, ProductPicker, useI18n, Button, ErrorState, Skeleton } from '@marketbd/ui';

export default function CampaignProductsPage() {
  const { money } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading, isError } = useAdminCampaignQuery(id);
  const { data: products } = useProductsQuery({ campaign: campaign?.slug, limit: 100 }, { skip: !campaign });
  const [mutate] = useAdminCampaignProductsMutation();
  const [picking, setPicking] = useState(false);

  if (isError) return <ErrorState message="Campaign not found" />;
  if (isLoading || !campaign) return <Skeleton className="h-64" />;

  const change = async (productIds: string[], remove = false) => {
    try {
      await mutate({ id, productIds, remove }).unwrap();
      toast.success(remove ? 'Removed' : 'Added');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title={campaign.title}
        description={`${campaign.productIds.length} products attached · visible products shown below`}
        actions={
          <>
            <Link href={storeUrl(`/campaign/${campaign.slug}`)} target="_blank" className="text-sm font-semibold text-primary-700">Preview ↗</Link>
            <Button onClick={() => setPicking(true)}><Plus className="size-4" /> Add products</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {products?.items.map((p) => (
          <div key={p.id} className="card relative overflow-hidden">
            <button type="button" onClick={() => void change([p.id], true)} className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white" aria-label="Remove">
              <X className="size-3.5" />
            </button>
            <div className="relative aspect-square bg-ink-50">
              {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="200px" className="object-cover" />}
            </div>
            <div className="p-2 text-xs">
              <p className="line-clamp-2">{p.title}</p>
              <p className="font-semibold text-accent-600">{money(p.price)}</p>
            </div>
          </div>
        ))}
      </div>
      <ProductPicker open={picking} onClose={() => setPicking(false)} onPick={(p) => void change([p.id])} />
    </div>
  );
}
