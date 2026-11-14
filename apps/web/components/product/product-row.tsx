'use client';

import type { ProductCard as ProductCardData } from '@marketbd/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@marketbd/ui';
import { ProductCard } from './product-card';

/** Horizontal product row with arrow controls. `card` wraps it in a white panel with a title bar. */
export function ProductRow({
  title,
  products,
  perRow = 4,
  card = false,
}: {
  title: string;
  products: ProductCardData[];
  perRow?: 4 | 6;
  card?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  const scroll = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section className={cn(card && 'rounded-lg bg-white p-4 shadow-card')}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={cn('font-semibold text-ink-900', card && 'text-lg')}>{title}</h2>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => scroll(-1)} className="rounded-full bg-white p-1.5 shadow-card hover:bg-ink-50" aria-label="Previous">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => scroll(1)} className="rounded-full bg-white p-1.5 shadow-card hover:bg-ink-50" aria-label="Next">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div ref={row} className="scrollbar-none flex gap-3 overflow-x-auto scroll-smooth">
        {products.map((p) => (
          <div
            key={p.id}
            className={cn(
              'w-40 shrink-0',
              perRow === 4 ? 'sm:w-[calc((100%-3*0.75rem)/4)]' : 'sm:w-[calc((100%-3*0.75rem)/4)] lg:w-[calc((100%-5*0.75rem)/6)]',
            )}
          >
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
