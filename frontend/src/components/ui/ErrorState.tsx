import clsx from 'clsx';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  correlationId?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title = 'Something went wrong', message, correlationId, onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={clsx('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      <h3 className="text-base font-semibold text-danger">{title}</h3>
      <p className="max-w-md text-sm text-muted">{message}</p>
      {correlationId && <p className="font-mono text-xs text-muted">Correlation ID: {correlationId}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          Retry
        </Button>
      )}
    </div>
  );
}
