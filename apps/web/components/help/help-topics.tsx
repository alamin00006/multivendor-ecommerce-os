'use client';

import type { HelpTopic } from '@marketbd/shared';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@marketbd/ui';

/** Topic list: a topic opens into its questions; each question opens into its answer. #slug opens a topic. */
export function HelpTopics({ topics }: { topics: HelpTopic[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);

  useEffect(() => {
    const fromHash = () => {
      const slug = window.location.hash.slice(1);
      if (topics.some((t) => t.slug === slug)) setOpen(slug);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [topics]);

  const toggle = (slug: string) => {
    const next = open === slug ? null : slug;
    setOpen(next);
    setQuestion(null);
    history.replaceState(null, '', next ? `#${next}` : window.location.pathname);
  };

  return (
    <div className="card divide-y divide-ink-100 overflow-hidden">
      {topics.map((t) => {
        const on = open === t.slug;
        return (
          <section key={t.slug} id={t.slug} className="scroll-mt-32">
            <button
              type="button"
              onClick={() => toggle(t.slug)}
              aria-expanded={on}
              className={cn('flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium', on ? 'bg-primary-700 text-white' : 'text-ink-900 hover:bg-ink-50')}
            >
              {t.title}
              {on ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4 text-ink-500" />}
            </button>
            {on && (
              <div className="bg-ink-50/60 p-3 md:p-4">
                <div className="rounded-lg bg-white p-3 md:p-4">
                  <h3 className="border-b border-ink-100 pb-3 text-lg font-semibold text-ink-900">{t.title}</h3>
                  <div className="mt-3 space-y-2">
                    {t.faq.map((f) => {
                      const qOn = question === f.q;
                      return (
                        <div key={f.q} className="rounded-md border border-ink-100">
                          <button type="button" onClick={() => setQuestion(qOn ? null : f.q)} aria-expanded={qOn} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm text-ink-800">
                            {f.q}
                            <ChevronDown className={cn('size-4 shrink-0 text-ink-500 transition', qOn && 'rotate-180')} />
                          </button>
                          {qOn && <p className="border-t border-ink-100 px-3 py-3 text-sm leading-relaxed text-ink-700">{f.a}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
