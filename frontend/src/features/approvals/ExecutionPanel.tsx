import { Check, Loader2, RotateCw, X } from 'lucide-react';
import type { Execution } from '@/api/types';
import { useRetryExecution } from '@/api/approvals';
import { ApiError } from '@/api/client';
import { Badge, Button, Spinner, type BadgeTone } from '@/components/ui';
import { cn } from '@/lib/utils';
import { EXECUTION_LABEL, formatTime } from './format';

const TONE: Record<Execution['status'], BadgeTone> = {
  PENDING: 'neutral',
  RUNNING: 'info',
  SUCCEEDED: 'success',
  FAILED: 'danger',
};

const ORDER: Execution['status'][] = ['PENDING', 'RUNNING', 'SUCCEEDED'];

/** Animated Pending -> Running -> Succeeded/Failed stepper (visual; the status badge is the accessible state). */
function ExecutionStepper({ status }: { status: Execution['status'] }) {
  const failed = status === 'FAILED';
  const idx = failed ? 2 : ORDER.indexOf(status);
  return (
    <ol aria-hidden="true" className="flex items-start">
      {ORDER.map((s, i) => {
        const isLast = i === ORDER.length - 1;
        const done = i < idx || (isLast && status === 'SUCCEEDED');
        const current = i === idx && !done;
        const bad = isLast && failed;
        return (
          <li key={s} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-500',
                  done && 'border-success bg-success text-white',
                  bad && 'border-danger bg-danger text-white',
                  current && !bad && 'border-primary bg-primary/10 text-primary',
                  !done && !current && !bad && 'border-border text-muted',
                )}
              >
                {bad ? (
                  <X className="h-4 w-4" />
                ) : done ? (
                  <Check className="h-4 w-4" />
                ) : current && s === 'RUNNING' ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  i + 1
                )}
              </span>
              <span className={cn('text-[11px]', (done || current || bad) && 'font-semibold')}>
                {isLast ? (failed ? 'Failed' : 'Succeeded') : EXECUTION_LABEL[s]}
              </span>
            </div>
            {!isLast && (
              <span className="mx-1 mt-4 h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                <span
                  className={cn(
                    'block h-full bg-success transition-all duration-700 ease-out motion-reduce:transition-none',
                    i < idx ? 'w-full' : current && s === 'RUNNING' ? 'w-1/2 animate-pulse motion-reduce:animate-none' : 'w-0',
                  )}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export interface ExecutionPanelProps {
  execution: Execution;
  canRetry: boolean;
  onNotice: (message: string, tone: 'success' | 'error') => void;
}

export function ExecutionPanel({ execution, canRetry, onNotice }: ExecutionPanelProps) {
  const retry = useRetryExecution();
  const showRetry = execution.status === 'FAILED' && execution.retryable && canRetry;

  return (
    <section aria-label="Execution status" className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Execution {execution.id}</h3>
        <Badge tone={TONE[execution.status]} data-testid="execution-status">
          {execution.status === 'RUNNING' && <Spinner size="sm" label="Execution running" />}
          {EXECUTION_LABEL[execution.status]}
        </Badge>
      </div>
      <ExecutionStepper status={execution.status} />
      <p className="text-xs text-muted">
        Started {formatTime(execution.started_at)}
        {execution.finished_at ? `, finished ${formatTime(execution.finished_at)}` : ''}
      </p>
      {execution.status === 'SUCCEEDED' && (
        <p className="rounded-lg bg-success/10 p-2 text-sm font-medium text-success">The change was written to the ERP.</p>
      )}
      {execution.error && (
        <p role="alert" className="rounded-lg bg-danger/10 p-2 text-sm text-danger">
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
          <RotateCw aria-hidden="true" className="h-4 w-4" />
          Retry execution
        </Button>
      )}
    </section>
  );
}
