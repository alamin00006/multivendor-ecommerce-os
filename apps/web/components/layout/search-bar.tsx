'use client';

import { useSearchSuggestQuery } from '@marketbd/api-client';
import { Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/client';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function SearchBar({ className = '' }: { className?: string }) {
  const { t, money } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounced = useDebounced(q.trim(), 200);
  const { data } = useSearchSuggestQuery(debounced, { skip: debounced.length < 2 });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (term: string) => {
    const value = term.trim();
    if (!value) return;
    setOpen(false);
    setQ(value);
    router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const kw = data?.keywords[active];
    go(kw ?? q);
  };

  const keywords = data?.keywords ?? [];
  const showPanel = open && debounced.length >= 2 && data && (keywords.length || data.products.length || data.categories.length);

  return (
    <div ref={box} className={`relative ${className}`}>
      <form onSubmit={submit} role="search" className="flex h-10 overflow-hidden rounded-md border-2 border-primary-700 bg-white">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, keywords.length - 1));
            if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, -1));
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={t.common.searchPlaceholder}
          aria-label={t.common.search}
          className="min-w-0 flex-1 px-3 text-sm outline-none"
          autoComplete="off"
        />
        <button type="submit" className="flex w-12 items-center justify-center bg-primary-700 text-white" aria-label={t.common.search}>
          <Search className="size-5" />
        </button>
      </form>
      {showPanel ? (
        <div className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-ink-100 bg-white shadow-raised">
          {keywords.map((k, i) => (
            <button
              key={k}
              type="button"
              onMouseDown={() => go(k)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50 ${i === active ? 'bg-ink-50' : ''}`}
            >
              <Search className="size-4 text-ink-400" />
              {k}
            </button>
          ))}
          {data.categories.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-primary-700 hover:bg-ink-50"
            >
              {t.common.categories}: {c.name}
            </Link>
          ))}
          {data.products.length > 0 && <div className="border-t border-ink-100" />}
          {data.products.slice(0, 4).map((p) => (
            <Link
              key={p.id}
              href={`/p/${p.slug}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-ink-50"
            >
              {p.imageUrl && <Image src={p.imageUrl} alt="" width={40} height={40} className="size-10 rounded object-cover" />}
              <span className="line-clamp-1 flex-1 text-sm">{p.title}</span>
              <span className="text-sm font-semibold text-accent-600">{money(p.price)}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
