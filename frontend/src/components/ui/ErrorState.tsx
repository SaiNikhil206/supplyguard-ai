import { CircleAlert, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    <div role="alert" className={cn('flex flex-col items-center gap-1.5 px-4 py-12 text-center', className)}>
      <CircleAlert aria-hidden="true" className="mb-2 h-10 w-10 text-danger/80" strokeWidth={1.25} />
      <h3 className="text-sm font-semibold text-danger">{title}</h3>
      <p className="max-w-md text-sm text-muted">{message}</p>
      {correlationId && <p className="font-mono text-xs text-muted">Correlation ID: {correlationId}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-3">
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
