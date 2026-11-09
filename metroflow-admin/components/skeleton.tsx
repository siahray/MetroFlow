import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-shimmer rounded", className)} role="status" aria-label="Loading" />
  );
}

export function IncidentCardSkeleton() {
  return (
    <div className="border-l-4 border-transparent p-4 border-b border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-4 w-32 mb-2" />
      <Skeleton className="h-3 w-24 mb-3" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded" />
        <Skeleton className="h-6 w-16 rounded" />
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-8 w-16 rounded" />
        <Skeleton className="h-8 w-16 rounded" />
      </div>
    </div>
  );
}

export function IncidentQueueSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex-1 divide-y divide-slate-100 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <IncidentCardSkeleton key={i} />
      ))}
    </div>
  );
}
