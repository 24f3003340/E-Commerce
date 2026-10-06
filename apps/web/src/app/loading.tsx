export default function Loading() {
  return (
    <div className="container space-y-4 py-4" aria-busy="true" aria-label="Loading">
      <div className="h-40 animate-pulse rounded-lg bg-gray-200 sm:h-72" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-lg bg-white p-3">
            <div className="aspect-[4/5] animate-pulse rounded-md bg-gray-200" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
