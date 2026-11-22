import { helpArticles, helpContext, helpIntro, type PublicSettings } from '@marketbd/shared';
import { ChevronDown, Mail, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/server-api';

/** Live return window and contact details from Admin → Settings (falls back to defaults). */
async function context() {
  return helpContext(await apiGet<PublicSettings>('/settings/public', { revalidate: 60 }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const key = (await params).slug?.[0];
  const article = helpArticles(await context()).find((a) => a.slug === key);
  return { title: article?.title ?? 'Help center' };
}

export default async function HelpPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const key = (await params).slug?.[0];
  const ctx = await context();
  const articles = helpArticles(ctx);
  const article = key ? articles.find((a) => a.slug === key) : undefined;
  if (key && !article) notFound();
  return (
    <div className="container-site grid grid-cols-1 gap-4 pt-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="card h-fit p-2 text-sm">
        <Link href="/help" className={`block rounded px-3 py-2 hover:bg-ink-50 ${!key ? 'font-semibold text-primary-700' : ''}`}>
          Help center
        </Link>
        {articles.map((a) => (
          <Link key={a.slug} href={`/help/${a.slug}`} className={`block rounded px-3 py-2 hover:bg-ink-50 ${a.slug === key ? 'font-semibold text-primary-700' : ''}`}>
            {a.title}
          </Link>
        ))}
      </nav>
      <article className="card space-y-3 p-6">
        <h1 className="font-display text-2xl font-bold">{article?.title ?? 'Help center'}</h1>
        {(article?.body ?? helpIntro(ctx)).map((p) => (
          <p key={p} className="leading-relaxed text-ink-700">
            {p}
          </p>
        ))}
        {article?.faq && (
          <div className="divide-y divide-ink-100 rounded-lg border border-ink-100">
            {article.faq.map((f) => (
              <details key={f.q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-ink-900">
                  {f.q}
                  <ChevronDown className="size-4 shrink-0 text-ink-400 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">{f.a}</p>
              </details>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3 border-t border-ink-100 pt-4 text-sm">
          <a href={`tel:${ctx.supportPhone}`} className="inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 hover:bg-ink-50">
            <Phone className="size-4 text-primary-700" /> {ctx.supportPhone}
          </a>
          <a href={`mailto:${ctx.supportEmail}`} className="inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 hover:bg-ink-50">
            <Mail className="size-4 text-primary-700" /> {ctx.supportEmail}
          </a>
        </div>
      </article>
    </div>
  );
}
