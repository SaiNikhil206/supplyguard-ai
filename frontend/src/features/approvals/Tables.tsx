import clsx from 'clsx';
import { latestExecution, type DecidedRow } from '@/api/approvals';
import type { RiskCaseDetail } from '@/api/types';
import { Badge, Money, Table, TableEmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui';
import { DECISION_LABEL, EXECUTION_LABEL, OPTION_LABEL, formatTime, sortedRecommendations, waitingTime } from './format';

const selectedRow = 'bg-primary/10';

export function QueueTable({
  items,
  selectedId,
  onSelect,
}: {
  items: RiskCaseDetail[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Table aria-label="Pending approvals">
      <THead>
        <tr>
          <TH>Case</TH>
          <TH>Supplier</TH>
          <TH>Top option</TH>
          <TH>Exposure</TH>
          <TH>Waiting</TH>
        </tr>
      </THead>
      <TBody>
        {items.length === 0 && <TableEmptyRow colSpan={5}>No approvals waiting</TableEmptyRow>}
        {items.map((c) => {
          const top = sortedRecommendations(c)[0];
          return (
            <TR key={c.id} className={clsx(selectedId === c.id && selectedRow)} onClick={() => onSelect(c.id)}>
              <TD>
                <button
                  type="button"
                  aria-pressed={selectedId === c.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(c.id);
                  }}
                  className="font-mono text-primary underline-offset-2 hover:underline"
                >
                  {c.id}
                </button>
              </TD>
              <TD>{c.supplier_name}</TD>
              <TD>{top ? OPTION_LABEL[top.option_type] : 'None'}</TD>
              <TD>
                <Money value={c.exposure} />
              </TD>
              <TD>{waitingTime(c.updated_at)}</TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

export function HistoryTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: DecidedRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Table aria-label="Decision history">
      <THead>
        <tr>
          <TH>Case</TH>
          <TH>Decision</TH>
          <TH>By</TH>
          <TH>Comment</TH>
          <TH>When</TH>
          <TH>Execution</TH>
        </tr>
      </THead>
      <TBody>
        {rows.length === 0 && <TableEmptyRow colSpan={6}>No decisions yet</TableEmptyRow>}
        {rows.map(({ approval: a, riskCase: c }) => {
          const ex = latestExecution(c);
          return (
            <TR key={a.id} className={clsx(selectedId === c.id && selectedRow)} onClick={() => onSelect(c.id)}>
              <TD>
                <button
                  type="button"
                  aria-pressed={selectedId === c.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(c.id);
                  }}
                  className="font-mono text-primary underline-offset-2 hover:underline"
                >
                  {c.id}
                </button>
              </TD>
              <TD>
                <Badge tone={a.decision === 'APPROVE' ? 'success' : a.decision === 'REJECT' ? 'danger' : 'warning'}>
                  {DECISION_LABEL[a.decision]}
                </Badge>
              </TD>
              <TD>{a.decided_by}</TD>
              <TD className="max-w-xs truncate" title={a.comments}>
                {a.comments || '-'}
              </TD>
              <TD>{formatTime(a.decided_at)}</TD>
              <TD>{ex ? EXECUTION_LABEL[ex.status] : '-'}</TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
