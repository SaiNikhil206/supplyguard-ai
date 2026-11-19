import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const styles: Record<Severity, string> = {
  LOW: 'bg-sev-low/15 text-sev-low border-sev-low/40',
  MEDIUM: 'bg-sev-medium/15 text-sev-medium border-sev-medium/40',
  HIGH: 'bg-sev-high/15 text-sev-high border-sev-high/40',
  CRITICAL: 'bg-sev-critical/15 text-sev-critical border-sev-critical/40',
};
const labels: Record<Severity, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };

export interface SeverityBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  severity: Severity;
}

export function SeverityBadge({ severity, className, ...rest }: SeverityBadgeProps) {
  return (
    <span
      data-severity={severity}
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold',
        styles[severity],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[severity]}
    </span>
  );
}
