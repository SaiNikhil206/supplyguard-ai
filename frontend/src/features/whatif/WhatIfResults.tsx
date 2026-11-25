import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Timer,
  Trophy,
} from "lucide-react";
import type { WhatIfResult } from "@/api/whatif";
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
import { InventoryGapChart } from "./InventoryGapChart";
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

export function WhatIfResults({ result }: { result: WhatIfResult }) {
  const best = result.best_option;
  const amount = useCountUp(Number(result.exposure.amount));
  return (
    <div
      className="space-y-4 duration-300 animate-in fade-in slide-in-from-bottom-2"
      aria-label="Simulation results"
      role="region"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="primary">
          <Timer aria-hidden="true" />
          Computed in {result.computed_ms} ms
        </Badge>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-primary/40 via-border to-transparent p-px">
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
                {result.affected_pos.length}
              </p>
              <p className="text-sm text-muted">Affected POs</p>
            </div>
          </div>
        </div>
      </div>

      <ChartCard
        title="Inventory gap"
        description="Shaded red where on-hand stock falls short of requirement"
      >
        <InventoryGapChart data={result.inventory_gap} />
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
                <TH>Value</TH>
                <TH>Due</TH>
                <TH>Days late (est.)</TH>
              </TR>
            </THead>
            <TBody>
              {result.affected_pos.length === 0 && (
                <TableEmptyRow colSpan={5}>
                  No purchase orders affected
                </TableEmptyRow>
              )}
              {result.affected_pos.map((p) => (
                <TR key={p.po_id}>
                  <TD className="font-mono text-xs">{p.po_id}</TD>
                  <TD>{p.item_name}</TD>
                  <TD>
                    <Money value={p.value} />
                  </TD>
                  <TD>{p.due_date}</TD>
                  <TD>
                    <Badge
                      tone={p.days_late_estimate > 7 ? "danger" : "warning"}
                    >
                      {p.days_late_estimate}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-emerald-500/40 via-border to-transparent p-px">
        <div className="space-y-3 rounded-2xl bg-card p-5">
          <div className="flex items-center gap-3">
            <IconTile tint={best ? "emerald" : "rose"}>
              {best ? <Trophy /> : <AlertTriangle />}
            </IconTile>
            <h3 className="text-sm font-semibold tracking-tight">
              Best option
            </h3>
          </div>
          {best ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <CheckCircle2
                  className="h-5 w-5 text-emerald-500"
                  aria-hidden="true"
                />
                {OPTION_LABELS[best.option_type]}
              </div>
              <p>{best.summary}</p>
              <p className="text-muted">
                Lead time:{" "}
                {best.estimated_lead_time_days === null
                  ? "Not available"
                  : `${best.estimated_lead_time_days} days`}
                {" · "}Cost change: <Money value={best.estimated_cost_delta} />
              </p>
            </div>
          ) : (
            <p className="text-sm font-semibold">No viable option</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div
          className={
            result.missing_data.length ? `${card} border-rose-500/40` : card
          }
        >
          <div className="border-b border-border/60 px-5 py-3.5">
            <h3 className="text-sm font-semibold tracking-tight">
              Missing data
            </h3>
          </div>
          <div className="p-5">
            {result.missing_data.length === 0 ? (
              <p className="text-sm text-muted">Nothing reported missing.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {result.missing_data.map((m) => (
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
