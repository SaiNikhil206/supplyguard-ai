import { AlertTriangle } from "lucide-react";

const clamp = (n: number) =>
  Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;

/** Live preview of the score bands: low / medium / high / critical on a 0-100 bar. */
export function RiskBands({
  medium,
  high,
  critical,
}: {
  medium: number;
  high: number;
  critical: number;
}) {
  const m = clamp(medium);
  const h = clamp(high);
  const c = clamp(critical);
  const valid =
    Number.isFinite(medium) &&
    Number.isFinite(high) &&
    Number.isFinite(critical) &&
    m < h &&
    h < c;
  const segs = [
    {
      key: "Low",
      from: 0,
      to: m,
      cls: "bg-emerald-500",
      txt: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "Medium",
      from: m,
      to: h,
      cls: "bg-amber-500",
      txt: "text-amber-600 dark:text-amber-400",
    },
    {
      key: "High",
      from: h,
      to: c,
      cls: "bg-orange-500",
      txt: "text-orange-600 dark:text-orange-400",
    },
    {
      key: "Critical",
      from: c,
      to: 100,
      cls: "bg-rose-500",
      txt: "text-rose-600 dark:text-rose-400",
    },
  ];
  return (
    <div className="space-y-3" data-testid="risk-bands">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Live preview</h3>
        <span className="text-xs text-muted">Score 0 to 100</span>
      </div>
      <div
        aria-hidden="true"
        className="flex h-4 overflow-hidden rounded-full bg-surface-2"
      >
        {segs.map((s) => (
          <div
            key={s.key}
            className={`${s.cls} transition-all duration-300`}
            style={{ width: `${Math.max(0, s.to - s.from)}%` }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {segs.map((s) => (
          <li
            key={s.key}
            className="rounded-lg border border-border/60 px-2 py-1.5"
          >
            <span className={`font-semibold ${s.txt}`}>{s.key}</span>
            <span className="block tabular-nums text-muted">
              {s.from} – {s.to}
            </span>
          </li>
        ))}
      </ul>
      {!valid && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Thresholds should increase: Medium &lt; High &lt; Critical.
        </p>
      )}
    </div>
  );
}
