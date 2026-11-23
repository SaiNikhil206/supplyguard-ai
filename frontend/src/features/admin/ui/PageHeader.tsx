import type { ReactNode } from "react";

/** v2 page header: title + one-line description left, actions right. Eyebrow kept for API compatibility (not shown). */
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="space-y-4 duration-200 animate-in fade-in slide-in-from-bottom-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted">{description}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
