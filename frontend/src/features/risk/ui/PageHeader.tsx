import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

/** Eyebrow + large title + description, actions on the right (DESIGN_DIRECTION page header recipe). */
export function PageHeader({ eyebrow, title, description, actions, children }: Props) {
  return (
    <header className="animate-in fade-in-0 slide-in-from-bottom-2 space-y-5 duration-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
          {description && <div className="mt-1.5 text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
