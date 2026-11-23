import { Skeleton } from '@/components/ui';

export function CaseDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading risk case" className="space-y-6">
      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="flex gap-6 pt-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}
