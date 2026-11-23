import { CheckCircle2, Timer } from "lucide-react";
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
import { StatCard } from "@/features/admin/ui/StatCard";
import { InventoryGapChart } from "./InventoryGapChart";
import { OPTION_LABELS } from "./labels";

const card = "rounded-lg border border-border bg-card";

export function WhatIfResults({ result }: { result: WhatIfResult }) {
  const best = result.best_option;
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

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Estimated exposure"
          value={
            <span className="text-danger">{formatMoney(result.exposure)}</span>
          }
          hint="Value of purchase orders at risk"
        />
        <StatCard
          label="Affected POs"
          value={result.affected_pos.length}
          hint="Open orders from this supplier in the window"
        />
      </div>

      <ChartCard
        title="Inventory gap"
        description="Shaded red where on-hand stock falls short of requirement"
      >
        <InventoryGapChart data={result.inventory_gap} />
      </ChartCard>

      <div className={card}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">
            Affected purchase orders
          </h3>
        </div>
        <div>
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

      <div className={card}>
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Best option</h3>
        </div>
        <div className="space-y-2 p-5 text-sm">
          {best ? (
            <>
              <div className="flex items-center gap-2 text-base font-semibold">
                <CheckCircle2
                  className="h-4 w-4 text-success"
                  strokeWidth={1.75}
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
            </>
          ) : (
            <p className="font-semibold">No viable option</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div
          className={
            result.missing_data.length ? `${card} border-warning/40` : card
          }
        >
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold">
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
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold">
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
