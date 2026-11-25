import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  /** Tailwind classes for the icon tile, e.g. 'bg-sev-high/10 text-sev-high'. */
  tone?: string;
  active?: boolean;
  /** Makes the card a toggle button; `ariaLabel` becomes its accessible name. */
  onClick?: () => void;
  ariaLabel?: string;
}

const base =
  'group relative flex w-full items-center gap-3 rounded-2xl border bg-card/80 p-5 text-left shadow-sm backdrop-blur transition hover:shadow-md';

/** KPI card; when `onClick` is set it acts as a filter toggle. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  active,
  onClick,
  ariaLabel,
}: Props) {
  const body = (
    <>
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', 'bg-foreground/5 text-muted')}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        <span className="block text-3xl font-semibold leading-tight tabular-nums">{value}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
    </>
  );
  const cls = cn(base, active ? 'border-primary ring-2 ring-primary/40' : 'border-border/60');
  if (onClick) {
    return (
      <button
        type="button"
        aria-pressed={!!active}
        aria-label={ariaLabel}
        onClick={onClick}
        className={cn(cls, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
      >
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
