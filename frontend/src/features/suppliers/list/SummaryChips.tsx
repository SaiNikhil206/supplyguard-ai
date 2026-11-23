import type { RiskLevel } from "@/api/types";
import { cn } from "@/lib/utils";
import { LEVEL_BAR } from "./risk";

const LEVELS: { value: RiskLevel; label: string }[] = [
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

export interface SummaryChipsProps {
  counts?: Record<RiskLevel, number>;
  active?: RiskLevel;
  onSelect: (level: RiskLevel | undefined) => void;
}

/** Clickable per-risk-level chips that double as filters (click again to clear). */
export function SummaryChips({ counts, active, onSelect }: SummaryChipsProps) {
  return (
    <div
      role="group"
      aria-label="Suppliers by risk level"
      className="flex flex-wrap gap-2"
    >
      {LEVELS.map((l) => {
        const on = active === l.value;
        return (
          <button
            key={l.value}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(on ? undefined : l.value)}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              on
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted hover:border-primary/40 hover:text-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn("h-2 w-2 rounded-full", LEVEL_BAR[l.value])}
            />
            <span>{l.label}</span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {counts ? counts[l.value] : "–"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
