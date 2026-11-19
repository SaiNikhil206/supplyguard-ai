import type { ReactNode } from 'react';
import clsx from 'clsx';
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
  className?: string;
}

const toneClass = { good: 'text-success', bad: 'text-danger', neutral: 'text-muted' } as const;
const toneWord = { good: 'favourable', bad: 'unfavourable', neutral: 'neutral' } as const;

export function KpiTile({ label, value, delta, hint, loading = false, className }: KpiTileProps) {
  return (
    <Card className={clsx('p-4', className)} aria-busy={loading || undefined}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      {loading ? (
        <div data-testid="kpi-skeleton" className="mt-2 space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : (
        <>
          <div className="mt-1 text-2xl font-semibold text-text">{value}</div>
          {delta && (
            <div className={clsx('mt-1 flex items-center gap-1 text-sm font-medium', toneClass[delta.tone])}>
              <span aria-hidden="true">{delta.direction === 'up' ? '▲' : '▼'}</span>
              <span>{delta.value}</span>
              <span className="sr-only">
                {delta.direction === 'up' ? 'increase' : 'decrease'}, {toneWord[delta.tone]}
              </span>
            </div>
          )}
          {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
        </>
      )}
    </Card>
  );
}
