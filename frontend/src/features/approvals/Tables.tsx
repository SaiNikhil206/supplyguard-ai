import clsx from 'clsx';
import { CircleCheck, Clock } from 'lucide-react';
import { Monogram, SEV_META } from '@/features/risk/ui';
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
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CircleCheck aria-hidden="true" className="h-6 w-6" />
        </span>
        <p className="font-semibold">No approvals waiting</p>
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
                'relative cursor-pointer overflow-hidden rounded-2xl border bg-card/80 p-4 pl-5 shadow-sm backdrop-blur transition hover:shadow-md',
                selected ? 'border-primary ring-2 ring-primary/30' : 'border-border/60',
              )}
            >
              <span aria-hidden="true" className={clsx('absolute inset-y-0 left-0 w-1', SEV_META[c.severity].bar)} />
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(c.id);
                  }}
                  className="font-mono text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {c.id}
                </button>
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium tabular-nums text-warning ring-1 ring-warning/25">
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
              <p className="mt-3 text-lg font-semibold tabular-nums">
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
