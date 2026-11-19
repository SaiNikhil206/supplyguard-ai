import type { WhatIfResult } from '@/api/whatif';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EvidenceTag,
  KpiTile,
  Money,
  Table,
  TableEmptyRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { InventoryGapChart } from './InventoryGapChart';
import { OPTION_LABELS } from './labels';

export function WhatIfResults({ result }: { result: WhatIfResult }) {
  const best = result.best_option;
  return (
    <div className="space-y-4" aria-label="Simulation results" role="region">
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiTile label="Estimated exposure" value={<Money value={result.exposure} />} />
        <KpiTile label="Affected POs" value={result.affected_pos.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Affected purchase orders</CardTitle>
        </CardHeader>
        <CardBody>
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
              {result.affected_pos.length === 0 && <TableEmptyRow colSpan={5}>No purchase orders affected</TableEmptyRow>}
              {result.affected_pos.map((p) => (
                <TR key={p.po_id}>
                  <TD>{p.po_id}</TD>
                  <TD>{p.item_name}</TD>
                  <TD>
                    <Money value={p.value} />
                  </TD>
                  <TD>{p.due_date}</TD>
                  <TD>{p.days_late_estimate}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory gap</CardTitle>
        </CardHeader>
        <CardBody>
          <InventoryGapChart data={result.inventory_gap} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Best option</CardTitle>
        </CardHeader>
        <CardBody>
          {best ? (
            <div className="space-y-1 text-sm">
              <div className="font-semibold">{OPTION_LABELS[best.option_type]}</div>
              <p>{best.summary}</p>
              <p className="text-muted">
                Lead time: {best.estimated_lead_time_days === null ? 'Not available' : `${best.estimated_lead_time_days} days`}
                {' · '}Cost change: <Money value={best.estimated_cost_delta} />
              </p>
            </div>
          ) : (
            <p className="text-sm font-semibold">No viable option</p>
          )}
        </CardBody>
      </Card>

      <Card className={result.missing_data.length ? 'border-danger/60' : undefined}>
        <CardHeader>
          <CardTitle>Missing data</CardTitle>
        </CardHeader>
        <CardBody>
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assumptions</CardTitle>
        </CardHeader>
        <CardBody>
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
        </CardBody>
      </Card>

      <p className="text-xs text-muted">Computed in {result.computed_ms} ms</p>
    </div>
  );
}
