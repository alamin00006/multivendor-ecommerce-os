import Markdown, { type Components } from 'react-markdown';

const components: Components = {
  h1: ({ children }) => <h2 className="mb-3 mt-6 text-xl font-semibold text-ink-900 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="mb-2 mt-6 text-lg font-semibold text-ink-900 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-4 font-semibold text-ink-900">{children}</h3>,
  p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-ink-600">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-ink-600">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-ink-600">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-ink-800">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} className="text-primary-700 hover:underline" rel={href?.startsWith('/') ? undefined : 'noopener nofollow'}>
      {children}
    </a>
  ),
};

/**
 * Admin-written buying guide shown under the product grid (server-rendered for SEO).
 * Raw HTML in the Markdown is not rendered — react-markdown escapes it by default.
 */
export function CategorySeo({ content }: { content: string }) {
  return (
    <section className="mt-10 rounded-lg bg-white p-5 shadow-card md:p-8">
      <Markdown components={components}>{content}</Markdown>
    </section>
  );
}
