'use client';

import { errorMessage, useIsAuthenticated, useProductsQuery, useStartConversationMutation } from '@marketbd/api-client';
import type { ProductSort } from '@marketbd/shared';
import { Loader2, MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ProductGrid } from '@/components/product/product-card';

/** "Chat Now" on the shop header. */
export function ShopChatButton({ slug }: { slug: string }) {
  const router = useRouter();
  const authed = useIsAuthenticated();
  const [start, state] = useStartConversationMutation();
  const open = async () => {
    if (!authed) return router.push(`/login?next=${encodeURIComponent(`/shop/${slug}`)}`);
    try {
      const conversation = await start({ sellerSlug: slug }).unwrap();
      router.push(`/account/messages?c=${conversation.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <button type="button" onClick={() => void open()} disabled={state.isLoading} className="flex flex-col items-center gap-0.5 text-xs font-semibold text-white drop-shadow disabled:opacity-60">
      {state.isLoading ? <Loader2 className="size-5 animate-spin" /> : <MessagesSquare className="size-5" />}
      Chat Now
    </button>
  );
}

/** Coloured section bar used on the shop page ("Featured Products", "All Products"…). */
export function ShopBar({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-primary-700 px-4 py-2.5 text-white">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className="h-5 w-1 rounded bg-white" aria-hidden />
        {title}
      </h2>
      {action}
    </div>
  );
}

/** One product row on the shop homepage (4 columns, like the reference). Hidden when empty. */
export function ShopSection({ slug, title, sort }: { slug: string; title: string; sort: ProductSort }) {
  const { data, isLoading } = useProductsQuery({ seller: slug, sort, limit: 8, page: 1 });
  if (!isLoading && !data?.items.length) return null;
  return (
    <section className="space-y-3">
      <ShopBar
        title={title}
        action={
          <Link href={`/shop/${slug}?tab=products&sort=${sort}`} className="text-sm font-medium text-white/90 hover:text-white">
            View all
          </Link>
        }
      />
      {/* Phones: one sideways-scrolling row; larger screens: a 4-column grid. */}
      <div className="-mx-3 overflow-x-auto px-3 scrollbar-none sm:mx-0 sm:overflow-visible sm:px-0">
        <ProductGrid
          products={data?.items ?? []}
          loading={isLoading}
          skeletons={4}
          cols="grid-flow-col auto-cols-[44%] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-3 lg:grid-cols-4"
        />
      </div>
    </section>
  );
}
