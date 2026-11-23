import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Accessible toggle (role="switch") with a label and optional description. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 text-muted [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
        )}
        <div className="space-y-0.5">
          <label id={`${id}-l`} htmlFor={id} className="text-sm font-medium">
            {label}
          </label>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
