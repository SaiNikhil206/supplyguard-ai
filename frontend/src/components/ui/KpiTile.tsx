import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Skeleton } from './Spinner';

export interface KpiDelta {
  value: string;
  direction: 'up' | 'down';
  /** Whether the change is good or bad for the business (independent of direction). */
  tone: 'good' | 'bad' | 'neutral';
}

export interface KpiTileProps {
  label: string;
  value: ReactNode;
  delta?: KpiDelta;
  hint?: string;
  loading?: boolean;
  /** Accepted for API compatibility; v2 stat tiles carry no icon squares, so it is not rendered. */
  icon?: ReactNode;
  /** Slot for a thin sparkline (e.g. Recharts line, 1.5px stroke) rendered under the value. */
  sparkline?: ReactNode;
  className?: string;
}

const deltaClass = { good: 'text-success', bad: 'text-danger', neutral: 'text-muted' } as const;
const toneWord = { good: 'favourable', bad: 'unfavourable', neutral: 'neutral' } as const;

export function KpiTile({ label, value, delta, hint, loading = false, sparkline, className }: KpiTileProps) {
  return (
    <Card className={cn('p-5', className)} aria-busy={loading || undefined}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      {loading ? (
        <div data-testid="kpi-skeleton" className="mt-3 space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : (
        <>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</div>
          {(delta || hint) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {delta && (
                <span className={cn('inline-flex items-center gap-0.5 font-medium', deltaClass[delta.tone])}>
                  {delta.direction === 'up' ? (
                    <ArrowUp aria-hidden="true" className="h-3 w-3" strokeWidth={1.75} />
                  ) : (
                    <ArrowDown aria-hidden="true" className="h-3 w-3" strokeWidth={1.75} />
                  )}
                  <span>{delta.value}</span>
                  <span className="sr-only">
                    {delta.direction === 'up' ? 'increase' : 'decrease'}, {toneWord[delta.tone]}
                  </span>
                </span>
              )}
              {hint && <span className="text-muted">{hint}</span>}
            </div>
          )}
          {sparkline && <div className="mt-3 h-9">{sparkline}</div>}
        </>
      )}
    </Card>
  );
}
