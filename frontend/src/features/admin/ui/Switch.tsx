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
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 text-primary [&_svg]:h-5 [&_svg]:w-5">
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
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          checked ? "bg-primary" : "bg-border",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
