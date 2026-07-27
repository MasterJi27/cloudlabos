"use client";

/** Shimmer placeholder used while list data loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[var(--surface-2)] ${className}`}
      aria-hidden="true"
    />
  );
}

/** A row of skeletons shaped like a table/list row. */
export function SkeletonRow({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-4 px-4">
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === 0 ? "flex-[2]" : "flex-1"}`}
        />
      ))}
    </div>
  );
}

/** Repeated skeleton rows for a loading list. */
export function SkeletonList({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-[rgba(255,255,255,0.04)]" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </div>
  );
}

/** Card-shaped skeleton for grid/card layouts. */
export function SkeletonCard() {
  return (
    <div className="card p-6 space-y-3" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
