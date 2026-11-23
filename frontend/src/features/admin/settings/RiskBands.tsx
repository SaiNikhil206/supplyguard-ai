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
      cls: "bg-sev-low",
      txt: "text-sev-low",
    },
    {
      key: "Medium",
      from: m,
      to: h,
      cls: "bg-sev-medium",
      txt: "text-sev-medium",
    },
    {
      key: "High",
      from: h,
      to: c,
      cls: "bg-sev-high",
      txt: "text-sev-high",
    },
    {
      key: "Critical",
      from: c,
      to: 100,
      cls: "bg-sev-critical",
      txt: "text-sev-critical",
    },
  ];
  return (
    <div className="space-y-3" data-testid="risk-bands">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live preview</h3>
        <span className="text-xs text-muted">Score 0 to 100</span>
      </div>
      <div
        aria-hidden="true"
        className="flex h-2 overflow-hidden rounded-full bg-surface-2"
      >
        {segs.map((s) => (
          <div
            key={s.key}
            className={`${s.cls} transition-all duration-200`}
            style={{ width: `${Math.max(0, s.to - s.from)}%` }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {segs.map((s) => (
          <li
            key={s.key}
            className="rounded-md border border-border px-2 py-1.5"
          >
            <span className={`font-semibold ${s.txt}`}>{s.key}</span>
            <span className="block tabular-nums text-muted">
              {s.from} – {s.to}
            </span>
          </li>
        ))}
      </ul>
      {!valid && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Thresholds should increase: Medium &lt; High &lt; Critical.
        </p>
      )}
    </div>
  );
}
