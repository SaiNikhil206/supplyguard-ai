import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const styles: Record<Severity, string> = {
  LOW: 'bg-sev-low/10 text-sev-low ring-sev-low/20',
  MEDIUM: 'bg-sev-medium/10 text-sev-medium ring-sev-medium/25',
  HIGH: 'bg-sev-high/10 text-sev-high ring-sev-high/25',
  CRITICAL: 'bg-sev-critical/10 text-sev-critical ring-sev-critical/25',
};
const labels: Record<Severity, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };

export interface SeverityBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  severity: Severity;
}

/** Soft-tint chip with a dot and always a text label (never colour alone). */
export function SeverityBadge({ severity, className, ...rest }: SeverityBadgeProps) {
  return (
    <span
      data-severity={severity}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        styles[severity],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {labels[severity]}
    </span>
  );
}
