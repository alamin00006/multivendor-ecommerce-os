'use client';

import type { CategoryNode } from '@marketbd/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useI18n, cn } from '@marketbd/ui';

/** Two-pane category browser (left: parents, right: sub-categories), as on mobile shopping apps. */
export function CategoryBrowser({ categories }: { categories: CategoryNode[] }) {
  const { t, pick } = useI18n();
  const [active, setActive] = useState(0);
  const current = categories[active];
  return (
    <div className="container-site pt-3">
      <h1 className="mb-3 font-display text-xl font-semibold">{t.common.allCategories}</h1>
      <div className="card flex min-h-[70vh] overflow-hidden">
        <ul className="w-28 shrink-0 overflow-y-auto border-r border-ink-100 bg-ink-50 md:w-60">
          {categories.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  'w-full px-3 py-3 text-left text-xs md:text-sm',
                  i === active ? 'border-l-4 border-primary-700 bg-white font-semibold text-primary-800' : 'text-ink-600',
                )}
              >
                {pick(c.name, c.nameBn)}
              </button>
            </li>
          ))}
        </ul>
        {current && (
          <div className="flex-1 p-4">
            <Link href={`/c/${current.slug}`} className="mb-4 block text-sm font-semibold text-primary-700">
              {pick(current.name, current.nameBn)} · {t.common.seeAll}
            </Link>
            <div className="grid grid-cols-3 gap-4 md:grid-cols-5">
              {current.children.map((sub) => (
                <Link key={sub.id} href={`/c/${sub.slug}`} className="flex flex-col items-center gap-2 text-center">
                  <span className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-50">
                    {sub.imageUrl && <Image src={sub.imageUrl} alt="" fill sizes="120px" className="object-cover" />}
                  </span>
                  <span className="text-xs text-ink-700">{pick(sub.name, sub.nameBn)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
