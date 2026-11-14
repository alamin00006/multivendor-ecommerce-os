'use client';

import { errorMessage, useAskQuestionMutation, useIsAuthenticated, useProductQuestionsQuery } from '@marketbd/api-client';
import { AskQuestionSchema } from '@marketbd/shared';
import { Button, cn, Skeleton, useHydrated } from '@marketbd/ui';
import { ChevronDown, MessageCircleQuestion } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Customer questions with seller/store answers, plus the ask box (login required). */
export function ProductQuestions({ productId }: { productId: string }) {
  // Gated on hydration: this segment can hydrate after the session is restored.
  const signedIn = useIsAuthenticated();
  const hydrated = useHydrated();
  const authed = signedIn && hydrated;
  const pathname = usePathname();
  const [limit, setLimit] = useState(4);
  const { data, isLoading, isFetching } = useProductQuestionsQuery({ productId, page: 1, limit });
  const [ask, askState] = useAskQuestionMutation();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = AskQuestionSchema.safeParse({ question: draft });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid question');
    setError(null);
    try {
      await ask({ productId, question: parsed.data.question }).unwrap();
      setDraft('');
      toast.success('Question sent — you will be notified when it is answered');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const total = data?.meta.total ?? 0;

  return (
    <section id="questions" className="card scroll-mt-48 p-5">
      <h2 className="mb-3 font-semibold text-ink-900">
        Questions about this product {total > 0 && <span className="font-normal text-ink-400">({total})</span>}
      </h2>

      {authed ? (
        <div className="mb-4 space-y-2">
          <textarea
            className="input h-20 py-2"
            placeholder="Ask the seller about size, material, compatibility…"
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          {error && <p className="field-error">{error}</p>}
          <Button size="sm" loading={askState.isLoading} disabled={draft.trim().length < 5} onClick={() => void submit()}>
            Ask question
          </Button>
        </div>
      ) : (
        <p className="mb-4 rounded-md bg-ink-50 px-3 py-2.5 text-sm text-ink-600">
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="font-semibold text-primary-700 hover:underline">
            Login
          </Link>{' '}
          or{' '}
          <Link href={`/register?next=${encodeURIComponent(pathname)}`} className="font-semibold text-primary-700 hover:underline">
            Register
          </Link>{' '}
          to ask questions to the seller
        </p>
      )}

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : !data?.items.length ? (
        <p className="flex items-center gap-2 py-4 text-sm text-ink-500">
          <MessageCircleQuestion className="size-4" /> No questions yet. Be the first to ask.
        </p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {data.items.map((q) => (
            <li key={q.id} className="space-y-2 py-3 text-sm">
              <div className="flex gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded bg-accent-500 text-[11px] font-bold text-white">Q</span>
                <div>
                  <p className="text-ink-800">{q.question}</p>
                  <p className="text-xs text-ink-400">
                    {q.askedBy.name} · {when(q.createdAt)}
                  </p>
                </div>
              </div>
              {q.answer && (
                <div className="flex gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded bg-primary-700 text-[11px] font-bold text-white">A</span>
                  <div>
                    <p className="text-ink-700">{q.answer}</p>
                    <p className="text-xs text-ink-400">
                      {q.answeredBy?.name ?? 'Seller'}
                      {q.answeredAt && ` · ${when(q.answeredAt)}`}
                    </p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && data.items.length < total && (
        <div className="mt-2 text-center">
          <button
            type="button"
            disabled={isFetching}
            onClick={() => setLimit((n) => n + 6)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full bg-ink-100 px-4 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-200',
              isFetching && 'opacity-60',
            )}
          >
            See more <ChevronDown className="size-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}
