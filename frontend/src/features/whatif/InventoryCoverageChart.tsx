import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WhatIfCoverageRow } from "@/api/whatif";
import { LegendChip } from "@/features/admin/ui/ChartCard";

/**
 * Stock cover (days) per item and location against the outage length.
 * Rows with unknown cover (no daily demand in the ERP) are listed, never drawn as zero.
 */
export function InventoryCoverageChart({
  rows,
  outageDays,
}: {
  rows: WhatIfCoverageRow[];
  outageDays: number;
}) {
  const known = rows
    .filter((r) => r.coverage_days !== null)
    .map((r) => ({
      label: `${r.item_id} @ ${r.location_id}`,
      coverage: r.coverage_days as number,
      short: (r.coverage_days as number) < outageDays,
    }));
  const unknown = rows.filter((r) => r.coverage_days === null);
  const shortCount = known.filter((r) => r.short).length;
  const summary = rows.length
    ? `${shortCount} of ${known.length} stock locations with known cover run out before the ${outageDays}-day outage ends.`
    : "No inventory records were returned for the affected items.";

  return (
    <div>
      <div className="sr-only">
        <p>{summary}</p>
        <table aria-label="Inventory coverage data">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Location</th>
              <th scope="col">Cover days</th>
              <th scope="col">Outage days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.item_id}-${r.location_id}`}>
                <td>{r.item_id}</td>
                <td>{r.location_id}</td>
                <td>
                  {r.coverage_days === null ? "Unknown" : r.coverage_days}
                </td>
                <td>{outageDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-2 text-sm text-muted">{summary}</p>
      {known.length > 0 && (
        <div aria-hidden="true">
          <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted">
            <LegendChip color="hsl(var(--primary))" label="Stock lasts the outage" />
            <LegendChip color="#f43f5e" label="Runs out first" />
            <LegendChip color="#f59e0b" label="Outage length" />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={known}
                margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-border/50"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  unit="d"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  y={outageDays}
                  stroke="#f59e0b"
                  strokeDasharray="5 3"
                />
                <Bar
                  dataKey="coverage"
                  name="Cover (days)"
                  radius={[6, 6, 0, 0]}
                  animationDuration={700}
                >
                  {known.map((r) => (
                    <Cell
                      key={r.label}
                      fill={r.short ? "#f43f5e" : "hsl(var(--primary))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {unknown.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Cover unknown (no daily demand in the ERP):{" "}
          {unknown.map((r) => `${r.item_id} @ ${r.location_id}`).join(", ")}.
        </p>
      )}
    </div>
  );
}
