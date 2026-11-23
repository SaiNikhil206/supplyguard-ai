import type { ReactNode } from 'react';

interface Props {
  /** Optional small breadcrumb-style label above the title (kept for API compatibility). */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

/** v2 page header: title + one-line description left, actions right (docs/DESIGN_DIRECTION.md section 3). */
export function PageHeader({ eyebrow, title, description, actions, children }: Props) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          {eyebrow && <p className="text-xs font-medium text-muted">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <div className="text-sm text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
