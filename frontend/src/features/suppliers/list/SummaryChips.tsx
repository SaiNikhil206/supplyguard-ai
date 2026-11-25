import type { RiskLevel } from '@/api/types';
import { cn } from '@/lib/utils';
import { LEVEL_BAR, LEVEL_SOFT } from './risk';

const LEVELS: { value: RiskLevel; label: string }[] = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

export interface SummaryChipsProps {
  counts?: Record<RiskLevel, number>;
  active?: RiskLevel;
  onSelect: (level: RiskLevel | undefined) => void;
}

/** Clickable per-risk-level chips that double as filters (click again to clear). */
export function SummaryChips({ counts, active, onSelect }: SummaryChipsProps) {
  return (
    <div role="group" aria-label="Suppliers by risk level" className="flex flex-wrap gap-2">
      {LEVELS.map((l) => {
        const on = active === l.value;
        return (
          <button
            key={l.value}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(on ? undefined : l.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              LEVEL_SOFT[l.value],
              on ? 'shadow-md ring-2' : 'opacity-90 hover:opacity-100 hover:shadow-sm',
            )}
          >
            <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', LEVEL_BAR[l.value])} />
            <span>{l.label}</span>
            <span className="rounded-full bg-card/70 px-1.5 text-xs font-semibold tabular-nums">
              {counts ? counts[l.value] : '–'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
