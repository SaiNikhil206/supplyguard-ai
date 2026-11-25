import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ChartCardProps {
  title: string;
  description?: string;
  /** Legend chips or actions shown top-right. */
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, description, legend, children, className }: ChartCardProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur transition hover:shadow-md',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        {legend}
      </div>
      {children}
    </section>
  );
}
