import { contentPages, helpContext, helpTopics, type PublicSettings } from '@marketbd/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { apiGet } from '@/lib/server-api';

async function context() {
  return helpContext(await apiGet<PublicSettings>('/settings/public', { revalidate: 60 }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = contentPages(await context()).find((p) => p.slug === slug);
  return { title: page?.title ?? 'Help Center' };
}

/** Policy / company page (About us, Privacy policy…): a plain white sheet like the reference. */
export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await context();
  const page = contentPages(ctx).find((p) => p.slug === slug);
  if (!page) {
    // Old links to a help topic (e.g. /help/faq) open the Help Center at that topic.
    if (helpTopics(ctx).some((t) => t.slug === slug)) redirect(`/help#${slug}`);
    // Older help links.
    const legacy: Record<string, string> = { faq: '/help', shipping: '/help#shipping-journey' };
    if (legacy[slug]) redirect(legacy[slug]);
    notFound();
  }
  return (
    <div className="container-site pt-4">
      <article className="card mx-auto max-w-5xl space-y-5 p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-ink-900 underline decoration-2 underline-offset-4">{page.title}</h1>
        {page.sections.map((s, i) => (
          <section key={s.heading ?? i} className="space-y-3">
            {s.heading && <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900">{s.heading}</h2>}
            {s.paragraphs.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-ink-700">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
