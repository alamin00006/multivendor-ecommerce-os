export default function Loading() {
  return (
    <div className="container-site space-y-4 pt-4" aria-busy="true">
      <div className="h-48 animate-pulse rounded-xl bg-ink-100 md:h-72" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-ink-100" />
        ))}
      </div>
    </div>
  );
}
