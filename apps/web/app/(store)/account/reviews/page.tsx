'use client';

import { errorMessage, useCreateReviewMutation, useMyReviewsQuery, usePendingReviewsQuery } from '@marketbd/api-client';
import { type ReviewableItem, ReviewSchema } from '@marketbd/shared';
import { Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, cn, Skeleton, Stars } from '@marketbd/ui';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });
const RATING_WORDS = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-2" onMouseLeave={() => setHover(0)}>
      <div className="flex" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="p-0.5"
          >
            <Star className={cn('size-7 transition', n <= shown ? 'fill-warning text-warning' : 'text-ink-300')} />
          </button>
        ))}
      </div>
      {shown > 0 && <span className="text-sm text-ink-600">{RATING_WORDS[shown]}</span>}
    </div>
  );
}

function ReviewForm({ item }: { item: ReviewableItem }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [create, state] = useCreateReviewMutation();

  const submit = async () => {
    if (!rating) return setError('Please choose a star rating');
    const parsed = ReviewSchema.safeParse({ productId: item.productId, rating, comment: comment.trim() || undefined });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check your review');
    setError(null);
    try {
      await create(parsed.data).unwrap();
      toast.success('Thanks for your review!');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <li className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="flex gap-3">
        <Link href={`/p/${item.productSlug}`} className="relative size-20 shrink-0 overflow-hidden rounded-md bg-ink-50">
          {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="80px" className="object-cover" />}
        </Link>
        <div className="min-w-0 text-sm">
          <Link href={`/p/${item.productSlug}`} className="line-clamp-2 font-medium text-ink-900 hover:text-primary-700">
            {item.title}
          </Link>
          {item.variantLabel && item.variantLabel !== 'Default' && <p className="text-xs text-ink-500">{item.variantLabel}</p>}
          <p className="mt-1 text-xs text-ink-500">
            Order {item.orderNumber}
            {item.deliveredAt && ` · Delivered ${date(item.deliveredAt)}`}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <StarPicker value={rating} onChange={setRating} />
        <textarea
          className="input h-20 py-2"
          maxLength={2000}
          placeholder="What did you like or dislike? How was the quality?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {error && <p className="field-error">{error}</p>}
        <Button size="sm" loading={state.isLoading} onClick={() => void submit()}>
          Submit review
        </Button>
      </div>
    </li>
  );
}

function ReviewsEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto mt-14 flex max-w-xl flex-col items-center rounded-lg bg-white px-6 pb-8 text-center shadow-card">
      <span className="-mt-11 grid size-24 place-items-center rounded-full border-4 border-ink-200 bg-white text-4xl font-bold text-ink-900">5.0</span>
      <span className="mt-4 flex gap-2" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className="size-8 fill-warning text-warning" />
        ))}
      </span>
      <p className="mt-6 text-xl font-semibold text-ink-900">{title}</p>
      <p className="mt-1.5 text-sm text-ink-600">{text}</p>
      <Link
        href="/"
        className="mt-4 w-full max-w-sm rounded-full bg-gradient-to-r from-primary-700 to-accent-500 py-2.5 font-semibold text-white hover:opacity-95"
      >
        Start Shopping
      </Link>
    </div>
  );
}

export default function MyReviewsPage() {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const { data: pending, isLoading: loadingPending } = usePendingReviewsQuery();
  const { data: history, isLoading: loadingHistory } = useMyReviewsQuery({ page: 1, limit: 50 });

  return (
    <div>
      <h1 className="mb-4 px-1 text-2xl font-semibold text-ink-900">My Reviews</h1>
      <div className="mb-4 rounded-lg bg-white px-4 shadow-card">
        <div className="flex gap-2" role="tablist">
          {(
            [
              ['pending', 'To Review'],
              ['history', 'History'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                '-mb-px border-b-2 px-2 py-3.5 text-[15px] transition',
                tab === key ? 'border-accent-500 font-semibold text-accent-600' : 'border-transparent font-medium text-ink-800 hover:text-accent-600',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'pending' ? (
        loadingPending ? (
          <Skeleton className="h-40" />
        ) : !pending?.length ? (
          <ReviewsEmpty title="No Products to Review Yet" text="Once you receive your order, you can share your feedback here." />
        ) : (
          <ul className="divide-y divide-ink-100 rounded-lg bg-white px-5 shadow-card md:px-6">
            {pending.map((item) => (
              <ReviewForm key={item.productId} item={item} />
            ))}
          </ul>
        )
      ) : loadingHistory ? (
        <Skeleton className="h-40" />
      ) : !history?.items.length ? (
        <ReviewsEmpty title="No Reviews Yet" text="Reviews you write for delivered items will be listed here." />
      ) : (
        <ul className="divide-y divide-ink-100 rounded-lg bg-white px-5 shadow-card md:px-6">
          {history.items.map((r) => (
            <li key={r.id} className="space-y-1.5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {r.product ? (
                  <Link href={`/p/${r.product.slug}`} className="font-medium text-ink-900 hover:text-primary-700">
                    {r.product.title}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="flex items-center gap-2">
                  {r.isVerifiedPurchase && <Badge tone="success">Verified purchase</Badge>}
                  {!r.isVisible && <Badge tone="danger">Hidden by moderator</Badge>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Stars value={r.rating} size={16} />
                <span className="text-xs text-ink-400">{date(r.createdAt)}</span>
              </div>
              {r.comment && <p className="text-sm text-ink-700">{r.comment}</p>}
              {r.images.length > 0 && (
                <div className="flex gap-2">
                  {r.images.map((u) => (
                    <Image key={u} src={u} alt="" width={56} height={56} className="size-14 rounded object-cover" />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
