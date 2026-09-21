// Shimmer skeleton placeholders for seamless (perceived-instant) loading.

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-line/60 ${className}`}
    >
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          animation: "shimmer 1.4s infinite",
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
        }}
      />
      <style>{`@keyframes shimmer{100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}

/** A generic card-shaped skeleton block. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 4, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}
