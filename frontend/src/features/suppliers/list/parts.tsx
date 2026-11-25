import type { RiskLevel } from '@/api/types';
import { cn } from '@/lib/utils';
import { LEVEL_BAR, gradFor, initials } from './risk';

/** Gradient monogram avatar; decorative (name is always rendered beside it). */
export function SupplierMonogram({ name, level, className }: { name: string; level?: RiskLevel; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-level={level}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-semibold text-white shadow-sm',
        gradFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Thin 0-100 bar coloured by risk level; the number sits beside it. */
export function RiskBar({ score, level, className }: { score?: number | null; level: RiskLevel; className?: string }) {
  const v = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
        <span className={cn('block h-full rounded-full', LEVEL_BAR[level])} style={{ width: `${v}%` }} />
      </span>
      <span className="w-6 text-right text-xs tabular-nums text-muted">{score == null ? '—' : v}</span>
    </span>
  );
}
