import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Spinner';

export type StatTone = 'primary' | 'emerald' | 'amber' | 'orange' | 'rose' | 'violet' | 'sky';

const TONE: Record<StatTone, { box: string; stroke: string }> = {
  primary: { box: 'bg-primary/10 text-primary', stroke: 'hsl(243 75% 60%)' },
  emerald: { box: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', stroke: '#10b981' },
  amber: { box: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', stroke: '#f59e0b' },
  orange: { box: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', stroke: '#f97316' },
  rose: { box: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', stroke: '#f43f5e' },
  violet: { box: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', stroke: '#8b5cf6' },
  sky: { box: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', stroke: '#0ea5e9' },
};

export interface StatDelta {
  value: string;
  direction: 'up' | 'down';
  /** Whether the change is good or bad for the business. */
  tone: 'good' | 'bad' | 'neutral';
}

/** Count-up for plain numbers; skips animation under prefers-reduced-motion. */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  // No matchMedia (e.g. jsdom) or reduced motion: render the final value with no animation.
  const [animate] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      typeof requestAnimationFrame === 'function' &&
      import.meta.env.MODE !== 'test' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [n, setN] = useState(animate ? 0 : value);
  const prev = useRef(0);
  useEffect(() => {
    if (!animate) return;
    const from = prev.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setN(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
      else prev.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, animate]);
  return <>{animate ? n : value}</>;
}

export interface StatCardProps {
  label: string;
  /** A number gets a count-up; any node is rendered as is. */
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  delta?: StatDelta;
  hint?: string;
  loading?: boolean;
  className?: string;
}

const chip = {
  good: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  bad: 'bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400',
  neutral: 'bg-foreground/5 text-muted ring-border',
} as const;

export function StatCard({ label, value, icon, tone = 'primary', delta, hint, loading, className }: StatCardProps) {
  const t = TONE[tone];
  return (
    <div
      aria-busy={loading || undefined}
      className={cn(
        'rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur transition hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
        {icon && (
          <div
            aria-hidden="true"
            className={cn('flex h-9 w-9 items-center justify-center rounded-xl [&_svg]:h-4 [&_svg]:w-4', t.box)}
          >
            {icon}
          </div>
        )}
      </div>
      {loading ? (
        <div data-testid="kpi-skeleton" className="mt-3 space-y-2">
          <Skeleton className="h-8 w-24" />
        </div>
      ) : (
        <>
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {typeof value === 'number' ? <CountUp value={value} /> : value}
          </div>
          {(delta || hint) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {delta && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                    chip[delta.tone],
                  )}
                >
                  {delta.direction === 'up' ? (
                    <ArrowUp aria-hidden="true" className="h-3 w-3" />
                  ) : (
                    <ArrowDown aria-hidden="true" className="h-3 w-3" />
                  )}
                  {delta.value}
                  <span className="sr-only">{delta.direction === 'up' ? ' increase' : ' decrease'}</span>
                </span>
              )}
              {hint && <span className="text-xs text-muted">{hint}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
