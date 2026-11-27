import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Timer,
  Trophy,
} from "lucide-react";
import type { WhatIfItemOption, WhatIfResult } from "@/api/whatif";
import {
  Badge,
  EvidenceTag,
  Money,
  Table,
  TableEmptyRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
  formatMoney,
} from "@/components/ui";
import { ChartCard } from "@/features/admin/ui/ChartCard";
import { IconTile } from "@/features/admin/ui/StatCard";
import { InventoryCoverageChart } from "./InventoryCoverageChart";
import { OPTION_LABELS } from "./labels";

function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = reduced ? 1 : Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const card =
  "rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur";

function OptionRow({ item }: { item: WhatIfItemOption }) {
  const rec = item.recommended;
  return (
    <li className="space-y-1 rounded-xl bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs">{item.item_id}</span>
        <span className="text-muted">{item.affected_qty} units</span>
        {item.status === "COVERED_BY_STOCK" && (
          <Badge tone="success">Covered by stock</Badge>
        )}
        {item.status === "NO_OPTION" && <Badge tone="danger">No option</Badge>}
        {rec && (
          <span className="flex items-center gap-1 font-semibold">
            <CheckCircle2
              className="h-4 w-4 text-emerald-500"
              aria-hidden="true"
            />
            {OPTION_LABELS[rec.option_type]}
            {rec.supplier_id ? ` ${rec.supplier_id}` : ""}
            {rec.from_location_id ? ` from ${rec.from_location_id}` : ""}
          </span>
        )}
      </div>
      {rec && (
        <p className="text-muted">
          Lead time:{" "}
          {rec.lead_time_days === null
            ? "Not available"
            : `${rec.lead_time_days} days`}
          {" · "}Cost change:{" "}
          {rec.estimated_cost_delta ? (
            <Money value={rec.estimated_cost_delta} />
          ) : (
            "Unknown"
          )}
        </p>
      )}
      {item.note && <p className="text-muted">{item.note}</p>}
    </li>
  );
}

export function WhatIfResults({ result }: { result: WhatIfResult }) {
  const best = result.best_option_estimate;
  const hasOption = !!best?.items.some((i) => i.status === "RECOMMENDED");
  const amount = useCountUp(Number(result.exposure.amount));
  const outageDays = result.scenario.duration_days;
  return (
    <div
      className="space-y-4 duration-300 animate-in fade-in slide-in-from-bottom-2"
      aria-label="Simulation results"
      role="region"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="primary">
          <Timer aria-hidden="true" />
          Computed in {result.client_ms} ms
        </Badge>
        <EvidenceTag kind="ESTIMATE" />
      </div>
      <p className="text-sm text-muted">{result.disclaimer}</p>

      <div className="rounded-2xl bg-border p-px">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-card p-6">
          <div className="space-y-1">
            <p className="text-sm text-muted">Estimated exposure</p>
            <p className="text-4xl font-semibold tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
              <span className="sr-only">{formatMoney(result.exposure)}</span>
              <span aria-hidden="true">
                {formatMoney({ amount, currency: result.exposure.currency })}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <IconTile tint="amber">
              <ClipboardList />
            </IconTile>
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {new Set(result.affected_pos.map((p) => p.po_id)).size}
              </p>
              <p className="text-sm text-muted">Affected POs</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted">Risk (estimate)</p>
            <p className="text-lg font-semibold tabular-nums">
              {result.risk.score} · {result.risk.level}
            </p>
            <p className="text-xs text-muted">
              Est. delay {result.estimated_delay_days} days
            </p>
          </div>
        </div>
      </div>

      <ChartCard
        title="Inventory cover"
        description="Days of stock per location against the length of the outage"
      >
        <InventoryCoverageChart
          rows={result.inventory.coverage}
          outageDays={outageDays}
        />
      </ChartCard>

      <div className={card}>
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h3 className="text-sm font-semibold tracking-tight">
            Affected purchase orders
          </h3>
        </div>
        <div className="p-2">
          <Table>
            <THead>
              <TR>
                <TH>PO</TH>
                <TH>Item</TH>
                <TH>Qty</TH>
                <TH>Exposure</TH>
                <TH>Due</TH>
                <TH>Days late (est.)</TH>
                <TH>Stock cover</TH>
              </TR>
            </THead>
            <TBody>
              {result.affected_pos.length === 0 && (
                <TableEmptyRow colSpan={7}>
                  No purchase orders affected
                </TableEmptyRow>
              )}
              {result.affected_pos.map((p) => (
                <TR key={`${p.po_id}-${p.item_id}`}>
                  <TD className="font-mono text-xs">{p.po_id}</TD>
                  <TD className="font-mono text-xs">{p.item_id}</TD>
                  <TD>{p.affected_qty}</TD>
                  <TD>
                    <Money value={p.exposure_amount} />
                  </TD>
                  <TD>{p.due_date}</TD>
                  <TD>
                    <Badge
                      tone={p.estimated_delay_days > 7 ? "danger" : "warning"}
                    >
                      {p.estimated_delay_days}
                    </Badge>
                  </TD>
                  <TD>
                    {p.inventory_coverage_days === null ? (
                      <span className="text-muted">Unknown</span>
                    ) : (
                      <Badge tone={p.shortage ? "danger" : "success"}>
                        {p.inventory_coverage_days} d
                      </Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </div>

      <div className="rounded-2xl bg-border p-px">
        <div className="space-y-3 rounded-2xl bg-card p-5">
          <div className="flex items-center gap-3">
            <IconTile tint={hasOption ? "emerald" : "rose"}>
              {hasOption ? <Trophy /> : <AlertTriangle />}
            </IconTile>
            <h3 className="text-sm font-semibold tracking-tight">
              Best option (estimate)
            </h3>
          </div>
          {best && hasOption ? (
            <div className="space-y-2 text-sm">
              <ul className="space-y-2">
                {best.items.map((i) => (
                  <OptionRow key={i.item_id} item={i} />
                ))}
              </ul>
              <p className="text-muted">
                Total cost change:{" "}
                <Money value={best.total_estimated_cost_delta} />
                {!best.cost_delta_complete &&
                  " (incomplete: some options have an unknown cost)"}
                {" · "}Longest lead time:{" "}
                {best.max_lead_time_days === null
                  ? "Not available"
                  : `${best.max_lead_time_days} days`}
              </p>
              {best.uncovered_item_ids.length > 0 && (
                <p className="font-medium text-rose-600 dark:text-rose-400">
                  No option for: {best.uncovered_item_ids.join(", ")}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">No viable option</p>
              {best && (
                <ul className="space-y-2">
                  {best.items.map((i) => (
                    <OptionRow key={i.item_id} item={i} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div
          className={
            result.data_gaps.length ? `${card} border-rose-500/40` : card
          }
        >
          <div className="border-b border-border/60 px-5 py-3.5">
            <h3 className="text-sm font-semibold tracking-tight">
              Missing data
            </h3>
          </div>
          <div className="p-5">
            {result.data_gaps.length === 0 ? (
              <p className="text-sm text-muted">Nothing reported missing.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {result.data_gaps.map((m) => (
                  <li key={m} className="flex items-start gap-2">
                    <EvidenceTag kind="MISSING_DATA" />
                    <span className="font-medium">{m}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className={card}>
          <div className="border-b border-border/60 px-5 py-3.5">
            <h3 className="text-sm font-semibold tracking-tight">
              Assumptions
            </h3>
          </div>
          <div className="p-5">
            {result.assumptions.length === 0 ? (
              <p className="text-sm text-muted">No assumptions reported.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {result.assumptions.map((a) => (
                  <li key={a} className="flex items-start gap-2">
                    <EvidenceTag kind="ASSUMPTION" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

