import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { EmptyState, ErrorState, Money, SeverityBadge, Skeleton } from '@/components/ui';
import { useRiskCases } from '@/api/queries';
import { Monogram, SEV_META } from '@/features/risk/ui';
import { cn } from '@/lib/utils';

const PICKABLE = ['RECOMMENDATION_READY', 'PENDING_APPROVAL'];

export function CasePicker() {
  const q = useRiskCases();
  if (q.isPending)
    return (
      <div role="status" aria-label="Loading cases" className="grid gap-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  const cases = q.data.results.filter((c) => PICKABLE.includes(c.status));
  if (cases.length === 0)
    return (
      <EmptyState
        icon={<Sparkles />}
        title="No cases with recommendations"
        description="Cases appear here once the AI has produced recovery options."
      />
    );
  return (
    <section aria-label="Choose a case">
      <h2 className="mb-3 text-sm font-semibold">Choose a case</h2>
      <ul className="grid gap-3">
        {cases.map((c) => (
          <li key={c.id}>
            <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur transition hover:shadow-md">
              <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', SEV_META[c.severity].bar)} />
              <div className="flex min-w-0 items-center gap-3">
                <Monogram name={c.supplier_name ?? c.supplier_id} className="h-10 w-10" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-muted">
                    {c.id} · {c.supplier_name ?? c.supplier_id} · {c.status.replace(/_/g, ' ').toLowerCase()}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs">
                    <SeverityBadge severity={c.severity} />
                    <Money value={c.exposure} className="font-medium" />
                  </p>
                </div>
              </div>
              <Link
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                to={`?case=${encodeURIComponent(c.id)}`}
                aria-label={`View options for ${c.id}`}
              >
                View options
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
