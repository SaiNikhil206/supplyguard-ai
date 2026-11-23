import clsx from 'clsx';
import { CircleCheck, Clock } from 'lucide-react';
import { Monogram } from '@/features/risk/ui';
import { latestExecution, type DecidedRow } from '@/api/approvals';
import type { RiskCaseDetail } from '@/api/types';
import { Badge, Money, Table, TableEmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui';
import { DECISION_LABEL, EXECUTION_LABEL, OPTION_LABEL, formatTime, sortedRecommendations, waitingTime } from './format';

const selectedRow = 'bg-primary/5';

export function QueueTable({
  items,
  selectedId,
  onSelect,
}: {
  items: RiskCaseDetail[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-10 text-center">
        <CircleCheck aria-hidden="true" className="h-10 w-10 text-muted" strokeWidth={1.5} />
        <p className="text-sm font-semibold">No approvals waiting</p>
        <p className="text-sm text-muted">You are all caught up. New recommendations appear here.</p>
      </div>
    );
  }
  return (
    <ul aria-label="Pending approvals" className="grid gap-3 sm:grid-cols-2">
      {items.map((c) => {
        const top = sortedRecommendations(c)[0];
        const selected = selectedId === c.id;
        return (
          <li key={c.id}>
            <div
              onClick={() => onSelect(c.id)}
              className={clsx(
                'cursor-pointer rounded-lg border bg-card p-4 transition-colors duration-150 hover:bg-surface-2/40',
                selected ? 'border-primary ring-1 ring-primary' : 'border-border',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(c.id);
                  }}
                  className="font-mono text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {c.id}
                </button>
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium tabular-nums text-warning ring-1 ring-inset ring-warning/25">
                  <Clock aria-hidden="true" className="h-3 w-3" />
                  {waitingTime(c.updated_at)}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <Monogram name={c.supplier_name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.supplier_name}</p>
                  <p className="truncate text-xs text-muted">{top ? OPTION_LABEL[top.option_type] : 'None'}</p>
                </div>
              </div>
              <p className="mt-3 text-base font-semibold tabular-nums">
                <Money value={c.exposure} />
              </p>
            </div>
          </li>
        );
      })}
    </ul>
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
            <TR key={a.id} className={clsx('cursor-pointer', selectedId === c.id && selectedRow)} onClick={() => onSelect(c.id)}>
              <TD>
                <button
                  type="button"
                  aria-pressed={selectedId === c.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(c.id);
                  }}
                  className="whitespace-nowrap font-mono text-xs text-primary underline-offset-2 hover:underline"
                >
                  {c.id}
                </button>
              </TD>
              <TD>
                <Badge tone={a.decision === 'APPROVE' ? 'success' : a.decision === 'REJECT' ? 'danger' : 'warning'}>
                  {DECISION_LABEL[a.decision]}
                </Badge>
              </TD>
              <TD className="whitespace-nowrap">{a.decided_by}</TD>
              <TD className="max-w-[10rem] truncate" title={a.comments}>
                {a.comments || '-'}
              </TD>
              <TD className="whitespace-nowrap text-muted">{formatTime(a.decided_at)}</TD>
              <TD>{ex ? EXECUTION_LABEL[ex.status] : '-'}</TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
