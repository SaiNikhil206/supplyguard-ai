import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Optional element rendered next to the eyebrow (e.g. a live pulse). */
  meta?: ReactNode;
  className?: string;
}

/** Shared page header recipe: eyebrow, large title, one-line description, actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 duration-200 animate-in fade-in slide-in-from-bottom-1",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {(eyebrow || meta) && (
          <div className="flex items-center gap-3">
            {eyebrow && (
              <p className="text-xs font-medium text-muted">{eyebrow}</p>
            )}
            {meta}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
