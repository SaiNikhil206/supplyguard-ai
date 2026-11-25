import { Link } from 'react-router-dom';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { useRiskCase } from '@/api/queries';
import { ComparisonChart } from './ComparisonChart';
import { ComparisonTable } from './ComparisonTable';
import { OptionCard } from './OptionCard';

const panel = 'rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur';

export function CaseRecommendations({ caseId }: { caseId: string }) {
  const q = useRiskCase(caseId);
  if (q.isPending)
    return (
      <div role="status" aria-label="Loading recommendations" className="space-y-4">
        <Skeleton className="h-56 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  const c = q.data;
  const recs = [...c.recommendations].sort((a, b) => a.rank - b.rank);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{c.title}</h2>
          <p className="text-xs text-muted">
            {c.id} · {c.supplier_name}
          </p>
        </div>
        <Button asChild>
          <Link to={`/approvals?case=${encodeURIComponent(c.id)}`}>
            Go to approval
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      {recs.length === 0 ? (
        c.no_viable_option_reason ? (
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>No viable recovery option</AlertTitle>
            <AlertDescription>{c.no_viable_option_reason}</AlertDescription>
          </Alert>
        ) : (
          <EmptyState title="No recommendations yet" description="The AI has not produced recovery options for this case." />
        )
      ) : (
        <>
          <section aria-label="Compare options" className={panel}>
            <h3 className="mb-4 text-base font-semibold">Compare options</h3>
            <ComparisonChart recs={recs} />
            <div className="mt-6 overflow-hidden rounded-xl border border-border/60">
              <ComparisonTable recs={recs} />
            </div>
          </section>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {recs.map((r) => (
              <OptionCard key={r.id} rec={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
