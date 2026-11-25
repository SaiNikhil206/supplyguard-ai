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
    <div role="alert" className={cn('flex flex-col items-center gap-2 px-4 py-12 text-center', className)}>
      <div
        aria-hidden="true"
        className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger ring-8 ring-danger/5"
      >
        <CircleAlert className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-danger">{title}</h3>
      <p className="max-w-md text-sm text-muted">{message}</p>
      {correlationId && <p className="font-mono text-xs text-muted">Correlation ID: {correlationId}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
