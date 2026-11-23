import { isPending, latestExecution, useWatchedCase } from '@/api/approvals';
import { ApiError } from '@/api/client';
import { Badge, Card, CardBody, CardHeader, CardTitle, ErrorState, Money, Spinner, StatusBadge } from '@/components/ui';
import { DecisionForm } from './DecisionForm';
import { ExecutionPanel } from './ExecutionPanel';
import { DECISION_LABEL, formatTime } from './format';

export interface CasePanelProps {
  caseId: string;
  canDecide: boolean;
  actor: string;
  onNotice: (message: string, tone: 'success' | 'error') => void;
}

export function CasePanel({ caseId, canDecide, actor, onNotice }: CasePanelProps) {
  const q = useWatchedCase(caseId);

  if (q.isLoading) {
    return (
      <Card>
        <CardBody>
          <Spinner label="Loading case" />
        </CardBody>
      </Card>
    );
  }
  if (q.error || !q.data) {
    return (
      <Card>
        <ErrorState
          message={q.error instanceof ApiError ? q.error.message : 'Could not load this case.'}
          correlationId={q.error instanceof ApiError ? (q.error.correlationId ?? undefined) : undefined}
          onRetry={() => void q.refetch()}
        />
      </Card>
    );
  }

  const c = q.data;
  const execution = latestExecution(c);
  return (
    <Card aria-label={`Case ${c.id}`}>
      <CardHeader>
        <CardTitle>
          {c.id} · {c.supplier_name}
        </CardTitle>
        <StatusBadge status={c.status} />
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm">{c.title}</p>
          <p className="text-xs text-muted">
            Exposure <Money value={c.exposure} /> · {c.affected_po_count} affected POs
          </p>
          {c.analysis && <p className="text-sm text-muted">{c.analysis.summary}</p>}
        </div>

        {isPending(c) && <DecisionForm key={c.id} riskCase={c} canDecide={canDecide} actor={actor} onNotice={onNotice} />}

        {c.approvals.length > 0 && !isPending(c) && (
          <ul className="space-y-1 text-sm">
            {c.approvals.map((a) => (
              <li key={a.id}>
                <Badge tone={a.decision === 'APPROVE' ? 'success' : a.decision === 'REJECT' ? 'danger' : 'warning'}>
                  {DECISION_LABEL[a.decision]}
                </Badge>{' '}
                by {a.decided_by} on {formatTime(a.decided_at)}
                {a.comments && <span className="block text-muted">&ldquo;{a.comments}&rdquo;</span>}
              </li>
            ))}
          </ul>
        )}

        {execution && <ExecutionPanel execution={execution} canRetry={canDecide} onNotice={onNotice} />}
      </CardBody>
    </Card>
  );
}
