export default function Loading() {
  return (
    <div className="ui-page py-14" aria-busy="true" aria-label="Loading">
      <div className="mx-auto mb-14 max-w-2xl space-y-4 text-center">
        <div className="mx-auto h-10 w-56 animate-pulse rounded-lg bg-stone-800/80" />
        <div className="mx-auto h-4 w-72 max-w-full animate-pulse rounded bg-stone-800/60" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="ui-panel h-48 animate-pulse p-5">
            <div className="mb-5 flex gap-4">
              <div className="h-14 w-14 rounded-full bg-stone-800" />
              <div className="flex-1 space-y-3 py-1">
                <div className="h-4 w-2/3 rounded bg-stone-800" />
                <div className="h-3 w-1/2 rounded bg-stone-800/70" />
              </div>
            </div>
            <div className="h-3 w-full rounded bg-stone-800/70" />
            <div className="mt-3 h-3 w-3/4 rounded bg-stone-800/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
