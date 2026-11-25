import type { HTMLAttributes } from 'react';
import { CircleCheck, CircleAlert, TriangleAlert, OctagonAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const styles: Record<Severity, string> = {
  LOW: 'bg-sev-low/10 text-sev-low border-sev-low/35',
  MEDIUM: 'bg-sev-medium/10 text-sev-medium border-sev-medium/35',
  HIGH: 'bg-sev-high/10 text-sev-high border-sev-high/35',
  CRITICAL: 'bg-sev-critical/10 text-sev-critical border-sev-critical/35',
};
const labels: Record<Severity, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };
const icons: Record<Severity, LucideIcon> = {
  LOW: CircleCheck,
  MEDIUM: CircleAlert,
  HIGH: TriangleAlert,
  CRITICAL: OctagonAlert,
};

export interface SeverityBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  severity: Severity;
}

export function SeverityBadge({ severity, className, ...rest }: SeverityBadgeProps) {
  const Icon = icons[severity];
  return (
    <span
      data-severity={severity}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        styles[severity],
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {labels[severity]}
    </span>
  );
}
