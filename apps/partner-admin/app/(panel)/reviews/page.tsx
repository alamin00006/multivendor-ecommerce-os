'use client';

import { errorMessage, useDeleteReviewReplyMutation, useReplyToReviewMutation, useSellerReviewStatsQuery, useSellerReviewsQuery } from '@marketbd/api-client';
import type { SellerReviewView } from '@marketbd/shared';
import { EyeOff, ImageOff, MessageSquare, MessageSquareReply, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, cn, EmptyState, fmtDate, PageHeader, Pager, Skeleton, storeUrl } from '@marketbd/ui';

function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-ink-200')} />
      ))}
    </span>
  );
}

function ReviewItem({ r }: { r: SellerReviewView }) {
  const [reply, replyState] = useReplyToReviewMutation();
  const [remove, removeState] = useDeleteReviewReplyMutation();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.sellerReply ?? '');

  const save = async () => {
    try {
      await reply({ id: r.id, reply: text.trim() }).unwrap();
      toast.success(r.sellerReply ? 'Reply updated' : 'Reply posted — the customer was notified');
      setEditing(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <article className="card p-4">
      <div className="flex gap-3">
        {r.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.imageUrl} alt="" className="size-14 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-300">
            <ImageOff className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link href={storeUrl(`/p/${r.product.slug}`)} target="_blank" className="line-clamp-1 text-sm font-medium hover:text-primary-700">
            {r.product.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
            <Stars value={r.rating} />
            <span>{r.user.name}</span>
            <span>· {fmtDate(r.createdAt)}</span>
            {r.isVerifiedPurchase && <Badge tone="success">Verified purchase</Badge>}
            {!r.isVisible && (
              <Badge tone="neutral">
                <EyeOff className="mr-1 size-3" /> Hidden by admin
              </Badge>
            )}
          </div>
        </div>
      </div>
      {r.comment ? <p className="mt-3 text-sm text-ink-800">{r.comment}</p> : <p className="mt-3 text-sm italic text-ink-400">No written comment</p>}
      {r.images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {r.images.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="Review photo" className="size-16 rounded-md object-cover" />
            </a>
          ))}
        </div>
      )}

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            className="input min-h-20"
            autoFocus
            aria-label="Your reply"
            placeholder="Thank the customer or explain how you will fix the problem. Your reply is public."
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={replyState.isLoading} disabled={text.trim().length < 2} onClick={() => void save()}>
              Post reply
            </Button>
          </div>
        </div>
      ) : r.sellerReply ? (
        <div className="mt-3 rounded-md border-l-2 border-primary-600 bg-primary-50 px-3 py-2 text-sm">
          <p className="flex items-center justify-between gap-2 text-xs font-semibold text-primary-800">
            Your reply {r.sellerRepliedAt && <span className="font-normal text-ink-500">{fmtDate(r.sellerRepliedAt)}</span>}
          </p>
          <p className="mt-0.5 text-ink-700">{r.sellerReply}</p>
          <div className="mt-1 flex gap-3 text-xs">
            <button type="button" className="font-medium text-primary-700" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              className="font-medium text-danger disabled:opacity-50"
              disabled={removeState.isLoading}
              onClick={() =>
                void remove(r.id)
                  .unwrap()
                  .then(() => {
                    setText('');
                    toast.success('Reply removed');
                  })
                  .catch((e: unknown) => toast.error(errorMessage(e)))
              }
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <MessageSquareReply className="size-4" /> Reply
          </Button>
        </div>
      )}
    </article>
  );
}

/** Seller Center → Reviews: ratings overview and public replies. */
export default function SellerReviewsPage() {
  const [rating, setRating] = useState<number | undefined>();
  const [replied, setReplied] = useState<'yes' | 'no' | undefined>('no');
  const [page, setPage] = useState(1);
  const { data: stats } = useSellerReviewStatsQuery();
  const { data, isLoading, isFetching } = useSellerReviewsQuery({ rating, replied, page, limit: 10 });

  return (
    <div>
      <PageHeader title="Reviews" description="See what customers say about your products and reply publicly." />
      {stats && (
        <div className="card mb-4 grid gap-4 p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="text-center sm:border-r sm:border-ink-100">
            <p className="text-4xl font-bold">{stats.average.toFixed(1)}</p>
            <Stars value={stats.average} size="size-5" />
            <p className="mt-1 text-xs text-ink-500">{stats.count} reviews</p>
            {stats.unreplied > 0 && <p className="mt-2 text-xs font-medium text-accent-600">{stats.unreplied} waiting for a reply</p>}
          </div>
          <div className="space-y-1.5">
            {(['5', '4', '3', '2', '1'] as const).map((k) => {
              const n = stats.distribution[k];
              const pct = stats.count ? (n / stats.count) * 100 : 0;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setRating(rating === Number(k) ? undefined : Number(k));
                    setPage(1);
                  }}
                  className={cn('flex w-full items-center gap-2 rounded px-1 text-xs', rating === Number(k) && 'bg-primary-50')}
                  aria-pressed={rating === Number(k)}
                >
                  <span className="w-8 text-left">{k} ★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 text-right text-ink-500">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
        {(
          [
            ['no', 'Needs reply'],
            ['yes', 'Replied'],
            [undefined, 'All'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={replied === k}
            onClick={() => {
              setReplied(k);
              setPage(1);
            }}
            className={cn('rounded-full border px-3 py-1 text-sm', replied === k ? 'border-primary-700 bg-primary-50 font-semibold text-primary-800' : 'border-ink-200 text-ink-600')}
          >
            {label}
          </button>
        ))}
        {rating && (
          <button type="button" onClick={() => setRating(undefined)} className="ml-auto text-xs font-medium text-primary-700">
            Clear {rating}★ filter
          </button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState icon={<MessageSquare />} title={replied === 'no' ? 'All caught up' : 'No reviews here'} text={replied === 'no' ? 'Every review has a reply.' : undefined} />
        </div>
      ) : (
        <div className={cn('space-y-3', isFetching && 'opacity-60')}>
          {data.items.map((r) => (
            <ReviewItem key={r.id} r={r} />
          ))}
        </div>
      )}
      {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
    </div>
  );
}
