export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-charcoal-100" />
        <div className="h-4 w-80 animate-pulse rounded bg-charcoal-100/70" />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-charcoal-100 bg-white p-5">
            <div className="mb-4 h-11 w-11 animate-pulse rounded-xl bg-charcoal-100" />
            <div className="h-8 w-16 animate-pulse rounded bg-charcoal-100" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-charcoal-100/70" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-charcoal-100 bg-white p-5 shadow-card">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-charcoal-50" />
          ))}
        </div>
        <span className="sr-only">Loading admin content…</span>
      </div>
    </div>
  );
}
