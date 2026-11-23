import { isPending, latestExecution, useWatchedCase } from '@/api/approvals';
import { ApiError } from '@/api/client';
import { AiChip, Badge, ErrorState, Money, Skeleton, StatusBadge } from '@/components/ui';
import { Monogram } from '@/features/risk/ui';
import { DecisionForm } from './DecisionForm';
import { ExecutionPanel } from './ExecutionPanel';
import { DECISION_LABEL, formatTime } from './format';

export interface CasePanelProps {
  caseId: string;
  canDecide: boolean;
  actor: string;
  onNotice: (message: string, tone: 'success' | 'error') => void;
}

const shell = 'rounded-lg border border-border bg-card';

export function CasePanel({ caseId, canDecide, actor, onNotice }: CasePanelProps) {
  const q = useWatchedCase(caseId);

  if (q.isLoading) {
    return (
      <div role="status" aria-label="Loading case" className={`${shell} space-y-3 p-5`}>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-10" />
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className={shell}>
        <ErrorState
          message={q.error instanceof ApiError ? q.error.message : 'Could not load this case.'}
          correlationId={q.error instanceof ApiError ? (q.error.correlationId ?? undefined) : undefined}
          onRetry={() => void q.refetch()}
        />
      </div>
    );
  }

  const c = q.data;
  const execution = latestExecution(c);
  return (
    <section aria-label={`Case ${c.id}`} className={`${shell} space-y-5 p-5`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Monogram name={c.supplier_name} />
          <h2 className="min-w-0 text-sm font-semibold">
            <span className="font-mono">{c.id}</span> · {c.supplier_name}
          </h2>
        </div>
        <StatusBadge status={c.status} />
      </header>
      <div className="space-y-1">
        <p className="text-sm text-foreground">{c.title}</p>
        <p className="text-xs text-muted">
          Exposure <Money value={c.exposure} /> · {c.affected_po_count} affected POs
        </p>
        {c.analysis && (
          <div className="mt-2 rounded-md border border-border bg-surface-2/50 p-3 text-sm text-muted">
            <AiChip className="mb-1.5" />
            <p>{c.analysis.summary}</p>
          </div>
        )}
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
    </section>
  );
}
