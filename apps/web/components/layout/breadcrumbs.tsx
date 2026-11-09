import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="scrollbar-none mb-3 overflow-x-auto text-xs text-ink-500 md:text-sm">
      <ol className="flex items-center gap-1 whitespace-nowrap">
        <li>
          <Link href="/" className="hover:text-primary-700">
            Home
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            {item.href && i < items.length - 1 ? (
              <Link href={item.href} className="hover:text-primary-700">
                {item.label}
              </Link>
            ) : (
              <span className="text-ink-800">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
