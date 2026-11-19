import type { Execution } from '@/api/types';
import { useRetryExecution } from '@/api/approvals';
import { ApiError } from '@/api/client';
import { Badge, Button, Spinner, type BadgeTone } from '@/components/ui';
import { EXECUTION_LABEL, formatTime } from './format';

const TONE: Record<Execution['status'], BadgeTone> = {
  PENDING: 'neutral',
  RUNNING: 'info',
  SUCCEEDED: 'success',
  FAILED: 'danger',
};

export interface ExecutionPanelProps {
  execution: Execution;
  canRetry: boolean;
  onNotice: (message: string, tone: 'success' | 'error') => void;
}

export function ExecutionPanel({ execution, canRetry, onNotice }: ExecutionPanelProps) {
  const retry = useRetryExecution();
  const showRetry = execution.status === 'FAILED' && execution.retryable && canRetry;

  return (
    <section aria-label="Execution status" className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Execution {execution.id}</h3>
        <Badge tone={TONE[execution.status]} data-testid="execution-status">
          {execution.status === 'RUNNING' && <Spinner size="sm" label="Execution running" />}
          {EXECUTION_LABEL[execution.status]}
        </Badge>
      </div>
      <p className="text-xs text-muted">
        Started {formatTime(execution.started_at)}
        {execution.finished_at ? `, finished ${formatTime(execution.finished_at)}` : ''}
      </p>
      {execution.status === 'SUCCEEDED' && (
        <p className="text-sm text-success">The change was written to the ERP.</p>
      )}
      {execution.error && (
        <p role="alert" className="text-sm text-danger">
          {execution.error}
          {execution.status === 'FAILED' && !execution.retryable && ' This error cannot be retried.'}
        </p>
      )}
      {showRetry && (
        <Button
          variant="secondary"
          size="sm"
          loading={retry.isPending}
          onClick={() =>
            retry.mutate(execution.id, {
              onSuccess: () => onNotice('Retry started.', 'success'),
              onError: (e) => onNotice(e instanceof ApiError ? e.message : 'Retry failed.', 'error'),
            })
          }
        >
          Retry execution
        </Button>
      )}
    </section>
  );
}
