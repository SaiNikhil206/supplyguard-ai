import { Link } from 'react-router-dom';
import { Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { useRiskCase } from '@/api/queries';
import { ComparisonTable } from './ComparisonTable';
import { OptionCard } from './OptionCard';

export function CaseRecommendations({ caseId }: { caseId: string }) {
  const q = useRiskCase(caseId);
  if (q.isPending) return <Spinner label="Loading recommendations" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  const c = q.data;
  const recs = [...c.recommendations].sort((a, b) => a.rank - b.rank);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{c.title}</h2>
          <p className="text-xs text-muted">
            {c.id} · {c.supplier_name}
          </p>
        </div>
        <Link
          className="rounded border border-border px-3 py-1.5 text-sm font-medium text-primary underline"
          to={`/approvals?case=${encodeURIComponent(c.id)}`}
        >
          Go to approval
        </Link>
      </div>
      {recs.length === 0 ? (
        c.no_viable_option_reason ? (
          <div role="alert" className="rounded border-2 border-warning p-4">
            <h3 className="font-semibold">No viable recovery option</h3>
            <p className="mt-1 text-sm">{c.no_viable_option_reason}</p>
          </div>
        ) : (
          <EmptyState title="No recommendations yet" description="The AI has not produced recovery options for this case." />
        )
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Compare options</CardTitle>
            </CardHeader>
            <CardBody>
              <ComparisonTable recs={recs} />
            </CardBody>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            {recs.map((r) => (
              <OptionCard key={r.id} rec={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
