'use client';

import { errorMessage, useAnswerQuestionMutation, useManagedQuestionsQuery, useModerateQuestionMutation } from '@marketbd/api-client';
import type { QuestionView } from '@marketbd/shared';
import { MessageCircleQuestion } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, cn, EmptyState, Skeleton } from '../primitives';
import { storeUrl } from '../urls';
import { fmtDate, PageHeader, Pager } from './panel';

function QuestionRow({ q, scope }: { q: QuestionView; scope: 'seller' | 'admin' }) {
  const [draft, setDraft] = useState(q.answer ?? '');
  const [editing, setEditing] = useState(!q.answer);
  const [answer, answerState] = useAnswerQuestionMutation();
  const [moderate, moderateState] = useModerateQuestionMutation();

  const submit = async () => {
    try {
      await answer({ scope, id: q.id, answer: draft }).unwrap();
      toast.success('Answer published — the customer was notified');
      setEditing(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <li className={cn('space-y-3 p-4', !q.isVisible && 'bg-ink-50 opacity-70')}>
      {q.product && (
        <Link href={storeUrl(`/p/${q.product.slug}`)} target="_blank" className="flex items-center gap-2 text-xs text-ink-500 hover:text-primary-700">
          {q.product.imageUrl && <Image src={q.product.imageUrl} alt="" width={28} height={28} className="size-7 rounded object-cover" />}
          <span className="line-clamp-1">{q.product.title}</span>
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold text-accent-600">Q:</span> {q.question}
          <span className="ml-2 text-xs text-ink-400">
            {q.askedBy.name} · {fmtDate(q.createdAt)}
          </span>
        </p>
        <div className="flex items-center gap-2">
          {q.answer ? <Badge tone="success">Answered</Badge> : <Badge tone="warning">Waiting</Badge>}
          {!q.isVisible && <Badge tone="danger">Hidden</Badge>}
          {scope === 'admin' && (
            <Button size="sm" variant="ghost" loading={moderateState.isLoading} onClick={() => void moderate({ id: q.id, isVisible: !q.isVisible })}>
              {q.isVisible ? 'Hide' : 'Show'}
            </Button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            className="input h-20 py-2"
            placeholder="Write a clear, helpful answer…"
            maxLength={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" loading={answerState.isLoading} disabled={draft.trim().length < 2} onClick={() => void submit()}>
              Publish answer
            </Button>
            {q.answer && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-primary-50 p-3 text-sm">
          <p>
            <span className="font-semibold text-primary-700">A:</span> {q.answer}
            {q.answeredBy && <span className="ml-2 text-xs text-ink-500">— {q.answeredBy.name}</span>}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      )}
    </li>
  );
}

/** Q&A inbox for the seller panel (own products) and the admin app (all products). */
export function QuestionsManager({ scope }: { scope: 'seller' | 'admin' }) {
  const [unanswered, setUnanswered] = useState(true);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useManagedQuestionsQuery({ scope, unanswered: unanswered || undefined, page, limit: 20 });
  return (
    <div>
      <PageHeader
        title="Customer questions"
        description={scope === 'seller' ? 'Questions asked on your products. Answers appear on the product page.' : 'Questions on every product. Hide anything inappropriate.'}
      />
      <div className="card">
        <div className="flex gap-1 border-b border-ink-100 p-2">
          {[
            { label: 'Waiting for answer', value: true },
            { label: 'All questions', value: false },
          ].map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => {
                setUnanswered(tab.value);
                setPage(1);
              }}
              className={cn('rounded-md px-3 py-1.5 text-sm', unanswered === tab.value ? 'bg-primary-700 text-white' : 'text-ink-600 hover:bg-ink-50')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : !data?.items.length ? (
          <EmptyState icon={<MessageCircleQuestion />} title={unanswered ? 'No questions waiting' : 'No questions yet'} />
        ) : (
          <ul className="divide-y divide-ink-100">
            {data.items.map((q) => (
              <QuestionRow key={q.id} q={q} scope={scope} />
            ))}
          </ul>
        )}
        {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
      </div>
    </div>
  );
}
