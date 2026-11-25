import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SectionTitleProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionTitle({ title, description, icon, action, className }: SectionTitleProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground/5 text-muted [&_svg]:h-4 [&_svg]:w-4"
          >
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-sm font-semibold leading-tight text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
