'use client';

import { errorMessage, useIsAuthenticated, useStartConversationMutation } from '@marketbd/api-client';
import { cn } from '@marketbd/ui';
import { Loader2, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/** Opens (or reuses) the chat with this product's shop and pre-attaches the product to the first message. */
export function ChatButton({ productId, slug, label, className }: { productId: string; slug: string; label: string; className?: string }) {
  const router = useRouter();
  const authed = useIsAuthenticated();
  const [start, state] = useStartConversationMutation();
  const open = async () => {
    if (!authed) return router.push(`/login?next=${encodeURIComponent(`/p/${slug}`)}`);
    try {
      const conversation = await start({ productId }).unwrap();
      router.push(`/account/messages?c=${conversation.id}&product=${encodeURIComponent(slug)}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={state.isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-60',
        className,
      )}
    >
      {state.isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />} {label}
    </button>
  );
}
