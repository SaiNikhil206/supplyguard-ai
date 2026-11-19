import { Link } from 'react-router-dom';
import { Card, CardBody, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { useRiskCases } from '@/api/queries';

const PICKABLE = ['RECOMMENDATION_READY', 'PENDING_APPROVAL'];

export function CasePicker() {
  const q = useRiskCases();
  if (q.isPending) return <Spinner label="Loading cases" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  const cases = q.data.results.filter((c) => PICKABLE.includes(c.status));
  if (cases.length === 0)
    return <EmptyState title="No cases with recommendations" description="Cases appear here once the AI has produced recovery options." />;
  return (
    <section aria-label="Choose a case">
      <h2 className="mb-2 text-sm font-semibold">Choose a case</h2>
      <ul className="space-y-2">
        {cases.map((c) => (
          <li key={c.id}>
            <Card>
              <CardBody className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-muted">
                    {c.id} · {c.supplier_name} · {c.status.replace(/_/g, ' ').toLowerCase()}
                  </p>
                </div>
                <Link className="text-sm font-medium text-primary underline" to={`?case=${encodeURIComponent(c.id)}`}>
                  View options for {c.id}
                </Link>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
