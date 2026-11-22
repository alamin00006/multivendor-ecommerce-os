'use client';

import {
  type ChatScope,
  errorMessage,
  sendChatTyping,
  useChatLive,
  useChatTyping,
  useChatThreadQuery,
  useConversationsQuery,
  useMarkConversationReadMutation,
  useProductQuery,
  useSendMessageMutation,
} from '@marketbd/api-client';
import type { ChatMessageView, ConversationView } from '@marketbd/shared';
import { ArrowLeft, CheckCheck, MessageCircle, Send, Store, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from './i18n';
import { cn, EmptyState, Skeleton } from './primitives';
import { storeUrl } from './urls';

// Fallback polling, used only while the Socket.IO channel is down.
const THREAD_POLL_MS = 4_000;
const INBOX_POLL_MS = 15_000;

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** The other party in a thread, from the viewer's point of view. */
const counterpart = (c: ConversationView) =>
  c.viewerSide === 'customer'
    ? { name: c.shop.name, image: c.shop.logoUrl, isStore: true }
    : { name: c.customer.name, image: c.customer.avatarUrl, isStore: false };

function Avatar({ name, image, size = 40 }: { name: string; image: string | null; size?: number }) {
  return image ? (
    <Image src={image} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-primary-100 font-semibold text-primary-800"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function ConversationRow({ c, active, onSelect }: { c: ConversationView; active: boolean; onSelect: () => void }) {
  const other = counterpart(c);
  const mine = c.lastMessage?.side === c.viewerSide;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn('flex w-full items-center gap-3 px-3 py-3 text-left transition', active ? 'bg-primary-50' : 'hover:bg-ink-50')}
      >
        <Avatar name={other.name} image={other.image} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn('truncate text-sm', c.unread ? 'font-bold text-ink-900' : 'font-medium text-ink-800')}>{other.name}</span>
            {c.lastMessage && <span className="shrink-0 text-[11px] text-ink-400">{timeLabel(c.lastMessage.createdAt)}</span>}
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className={cn('truncate text-xs', c.unread ? 'font-semibold text-ink-800' : 'text-ink-500')}>
              {c.lastMessage ? `${mine ? 'You: ' : ''}${c.lastMessage.body}` : 'No messages yet'}
            </span>
            {c.unread > 0 && (
              <span className="shrink-0 rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">{c.unread > 99 ? '99+' : c.unread}</span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function ProductChip({ product }: { product: NonNullable<ChatMessageView['product']> }) {
  const { money } = useI18n();
  return (
    <Link
      href={storeUrl(`/p/${product.slug}`)}
      target="_blank"
      className="mb-1.5 flex items-center gap-2 rounded-lg border border-ink-100 bg-white p-2 text-ink-800 hover:border-primary-300"
    >
      {product.imageUrl && <Image src={product.imageUrl} alt="" width={44} height={44} className="size-11 rounded object-cover" />}
      <span className="min-w-0">
        <span className="line-clamp-2 text-xs">{product.title}</span>
        <span className="text-sm font-bold text-accent-600">{money(product.price)}</span>
      </span>
    </Link>
  );
}

function Thread({ id, onBack, attachSlug, onAttachDone }: { id: string; onBack: () => void; attachSlug: string | null; onAttachDone: () => void }) {
  const { money } = useI18n();
  const [limit, setLimit] = useState(50);
  const live = useChatLive();
  const typing = useChatTyping(id);
  const { data, isLoading, isError } = useChatThreadQuery({ id, limit }, { pollingInterval: live ? 0 : THREAD_POLL_MS, skipPollingIfUnfocused: true });
  // currentData (not data) so a dropped ?product= does not keep showing the last product.
  const { currentData: attach } = useProductQuery(attachSlug ?? '', { skip: !attachSlug });
  const [attachDismissed, setAttachDismissed] = useState(false);
  const [send, sendState] = useSendMessageMutation();
  const [markRead] = useMarkConversationReadMutation();
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const lastSeenIncoming = useRef<string | null>(null);

  const messages = useMemo(() => data?.messages ?? [], [data]);
  const conversation = data?.conversation;
  const lastId = messages.at(-1)?.id;

  // Keep the newest message in view.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  // Mark the thread read when it opens with unread messages or a new incoming message arrives.
  useEffect(() => {
    if (!conversation) return;
    const lastIncoming = [...messages].reverse().find((m) => m.side !== conversation.viewerSide)?.id ?? null;
    if (conversation.unread > 0 || (lastIncoming && lastIncoming !== lastSeenIncoming.current && lastSeenIncoming.current !== null)) {
      void markRead(id);
    }
    lastSeenIncoming.current = lastIncoming;
  }, [conversation, messages, id, markRead]);

  if (isLoading) return <Skeleton className="m-4 h-64" />;
  if (isError || !conversation) return <EmptyState icon={<MessageCircle />} title="This conversation is not available" />;

  const other = counterpart(conversation);
  const readUpTo = conversation.otherLastReadAt ? new Date(conversation.otherLastReadAt).getTime() : 0;
  const lastMine = [...messages].reverse().find((m) => m.side === conversation.viewerSide);
  // Only products of this thread's shop can be attached (the seller block is hidden in single-vendor mode).
  const attachProduct = !attach || attachDismissed || (attach.seller && attach.seller.id !== conversation.shop.id) ? null : attach;
  const dropAttachment = () => {
    setAttachDismissed(true);
    onAttachDone();
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await send({ id, body, productId: attachProduct?.id }).unwrap();
      setDraft('');
      if (attachProduct) dropAttachment();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
        <button type="button" onClick={onBack} className="-ml-1 rounded p-1 text-ink-600 hover:bg-ink-50 md:hidden" aria-label="Back to conversations">
          <ArrowLeft className="size-5" />
        </button>
        <Avatar name={other.name} image={other.image} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink-900">{other.name}</p>
          {typing ? (
            <p className="text-xs font-medium text-primary-600">typing…</p>
          ) : conversation.viewerSide === 'seller' ? (
            <p className="text-xs text-ink-500">Customer</p>
          ) : null}
        </div>
        {conversation.viewerSide === 'customer' && !conversation.shop.isHouseStore && (
          <Link href={storeUrl(`/shop/${conversation.shop.slug}`)} className="flex items-center gap-1 rounded-md bg-primary-50 px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100">
            <Store className="size-3.5" /> Visit store
          </Link>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-ink-50/60 px-4 py-3">
        {data?.hasMore && (
          <div className="pb-2 text-center">
            <button type="button" onClick={() => setLimit((n) => Math.min(n + 50, 200))} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-600 shadow-sm hover:text-primary-700">
              Load older messages
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-500">
            {conversation.viewerSide === 'customer' ? `Ask ${other.name} anything about their products.` : 'No messages yet.'}
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.side === conversation.viewerSide;
          const newDay = i === 0 || dayLabel(messages[i - 1]!.createdAt) !== dayLabel(m.createdAt);
          return (
            <div key={m.id}>
              {newDay && (
                <p className="py-2 text-center">
                  <span className="rounded-full bg-white px-3 py-0.5 text-[11px] text-ink-500 shadow-sm">{dayLabel(m.createdAt)}</span>
                </p>
              )}
              <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className="max-w-[78%]">
                  {m.product && <ProductChip product={m.product} />}
                  <div
                    className={cn(
                      'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm',
                      mine ? 'rounded-br-md bg-primary-700 text-white' : 'rounded-bl-md bg-white text-ink-800 shadow-sm',
                    )}
                  >
                    {m.body}
                  </div>
                  <p className={cn('mt-0.5 flex items-center gap-1 text-[10px] text-ink-400', mine && 'justify-end')}>
                    {timeLabel(m.createdAt)}
                    {mine && m.id === lastMine?.id && new Date(m.createdAt).getTime() <= readUpTo && (
                      <>
                        · <CheckCheck className="size-3 text-primary-600" /> Seen
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <div className="border-t border-ink-100 p-3">
        {attachProduct && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary-50 p-2 text-xs">
            {attachProduct.images[0] && <Image src={attachProduct.images[0].url} alt="" width={36} height={36} className="size-9 rounded object-cover" />}
            <span className="min-w-0 flex-1">
              <span className="block text-ink-500">Asking about</span>
              <span className="line-clamp-1 font-medium text-ink-800">{attachProduct.title}</span>
            </span>
            <span className="font-bold text-accent-600">{money(attachProduct.price)}</span>
            <button type="button" onClick={dropAttachment} className="rounded p-1 text-ink-500 hover:bg-white" aria-label="Remove product">
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (e.target.value.trim()) sendChatTyping(id);
            }}
            onKeyDown={onKey}
            rows={1}
            maxLength={2000}
            placeholder="Type a message…"
            className="input max-h-32 min-h-11 flex-1 resize-none py-2.5"
            aria-label="Message"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!draft.trim() || sendState.isLoading}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-700 text-white transition hover:bg-primary-800 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-ink-400">Enter to send · Shift + Enter for a new line</p>
      </div>
    </div>
  );
}

/**
 * Two-pane messenger: conversations on the left, the open thread on the right (one pane at a time on phones).
 * The open thread lives in the URL (`?c=<id>`); `?product=<slug>` pre-attaches a product to the next message.
 */
export function ChatInbox({ scope, className }: { scope: ChatScope; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get('c');
  const attachSlug = params.get('product');
  const live = useChatLive();
  const { data, isLoading } = useConversationsQuery({ scope, page: 1, limit: 50 }, { pollingInterval: live ? 0 : INBOX_POLL_MS, skipPollingIfUnfocused: true });

  const go = (c: string | null, product: string | null = null) => {
    const next = new URLSearchParams();
    if (c) next.set('c', c);
    if (product) next.set('product', product);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className={cn('card grid h-[calc(100vh-11rem)] min-h-[480px] overflow-hidden md:grid-cols-[320px_1fr]', className)}>
      <div className={cn('min-h-0 flex-col border-r border-ink-100', selected ? 'hidden md:flex' : 'flex')}>
        <p className="border-b border-ink-100 px-4 py-3 font-semibold">Messages</p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <Skeleton className="m-3 h-40" />
          ) : !data?.items.length ? (
            <EmptyState
              icon={<MessageCircle />}
              title="No conversations yet"
              text={scope === 'customer' ? 'Use “Chat” on a product page to message the seller.' : 'Customer messages will appear here.'}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.items.map((c) => (
                <ConversationRow key={c.id} c={c} active={c.id === selected} onSelect={() => go(c.id)} />
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className={cn('min-h-0', selected ? 'block' : 'hidden md:block')}>
        {selected ? (
          <Thread key={selected} id={selected} attachSlug={attachSlug} onBack={() => go(null)} onAttachDone={() => go(selected)} />
        ) : (
          <div className="grid h-full place-items-center">
            <EmptyState icon={<MessageCircle />} title="Select a conversation" text="Pick a chat on the left to read and reply." />
          </div>
        )}
      </div>
    </div>
  );
}
