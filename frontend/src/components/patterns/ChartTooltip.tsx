export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ value?: number | string; color?: string; name?: string | number }>;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
  seriesLabel?: string;
}

/** Recharts custom tooltip using the shared card recipe. */
export function ChartTooltip({ active, label, payload, labelFormatter, valueFormatter, seriesLabel }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const fmtL = labelFormatter ?? String;
  const fmtV = valueFormatter ?? String;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 px-3 py-2 text-xs shadow-lift backdrop-blur">
      <div className="mb-1 font-medium text-muted">{fmtL(String(label ?? ''))}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{seriesLabel ?? p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">{fmtV(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}
