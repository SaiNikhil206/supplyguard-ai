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
  /** Optional lucide icon (or any node) shown top-right in a tinted chip. */
  icon?: ReactNode;
  /** Slot for a small chart (e.g. a Recharts sparkline) rendered under the value. */
  sparkline?: ReactNode;
  className?: string;
}

const chipClass = {
  good: 'bg-success/10 text-success',
  bad: 'bg-danger/10 text-danger',
  neutral: 'bg-surface-2 text-muted',
} as const;
const toneWord = { good: 'favourable', bad: 'unfavourable', neutral: 'neutral' } as const;

export function KpiTile({ label, value, delta, hint, loading = false, icon, sparkline, className }: KpiTileProps) {
  return (
    <Card className={cn('p-5 transition-shadow hover:shadow-lift', className)} aria-busy={loading || undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
        {icon && (
          <div
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground [&_svg]:h-4 [&_svg]:w-4"
          >
            {icon}
          </div>
        )}
      </div>
      {loading ? (
        <div data-testid="kpi-skeleton" className="mt-3 space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : (
        <>
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value}</div>
          {(delta || hint) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {delta && (
                <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold', chipClass[delta.tone])}>
                  {delta.direction === 'up' ? (
                    <ArrowUp aria-hidden="true" className="h-3 w-3" />
                  ) : (
                    <ArrowDown aria-hidden="true" className="h-3 w-3" />
                  )}
                  <span>{delta.value}</span>
                  <span className="sr-only">
                    {delta.direction === 'up' ? 'increase' : 'decrease'}, {toneWord[delta.tone]}
                  </span>
                </span>
              )}
              {hint && <span className="text-xs text-muted">{hint}</span>}
            </div>
          )}
          {sparkline && <div className="mt-3 h-10">{sparkline}</div>}
        </>
      )}
    </Card>
  );
}
