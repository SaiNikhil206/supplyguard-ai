import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Accepted for API compatibility; v2 KPI cards carry no icon tiles, so it is not rendered. */
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  /** Tailwind class for the small status dot before the label, e.g. 'bg-sev-high'. */
  dot?: string;
  /** Legacy tint classes; ignored in v2. */
  tone?: string;
  active?: boolean;
  /** Makes the card a toggle button; `ariaLabel` becomes its accessible name. */
  onClick?: () => void;
  ariaLabel?: string;
}

const base = 'block w-full rounded-lg border bg-card p-5 text-left transition-colors duration-150';

/** v2 KPI card: uppercase label, big tabular number, small text. Colour only in the dot. */
export function StatCard({ label, value, hint, dot, active, onClick, ariaLabel }: Props) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        {dot && <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
        {label}
      </span>
      <span className="mt-1.5 block text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</span>
      {hint && <span className="mt-1 block truncate text-xs text-muted">{hint}</span>}
    </>
  );
  const cls = cn(base, active ? 'border-primary ring-1 ring-primary' : 'border-border');
  if (onClick) {
    return (
      <button
        type="button"
        aria-pressed={!!active}
        aria-label={ariaLabel}
        onClick={onClick}
        className={cn(
          cls,
          'hover:bg-surface-2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
