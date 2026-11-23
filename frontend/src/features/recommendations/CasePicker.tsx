import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { EmptyState, ErrorState, Money, SeverityBadge, Skeleton } from '@/components/ui';
import { useRiskCases } from '@/api/queries';
import { Monogram } from '@/features/risk/ui';

const PICKABLE = ['RECOMMENDATION_READY', 'PENDING_APPROVAL'];

export function CasePicker() {
  const q = useRiskCases();
  if (q.isPending)
    return (
      <div role="status" aria-label="Loading cases" className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
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
      <h2 className="mb-3 text-sm font-semibold text-foreground">Choose a case</h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {cases.map((c) => (
          <li key={c.id}>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-5 transition-colors duration-150 hover:bg-surface-2/40">
              <div className="flex min-w-0 items-center gap-3">
                <Monogram name={c.supplier_name} className="h-9 w-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{c.id}</span> · {c.supplier_name} · {c.status.replace(/_/g, ' ').toLowerCase()}
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
              >
                View options for {c.id}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
