import { Link } from 'react-router-dom';
import type { RiskCaseListItem } from '@/api/types';
import { Money, SeverityBadge, StatusBadge, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { cn } from '@/lib/utils';
import { SEV_META } from '../ui';
import { eventTypeLabel, relativeTime } from './format';

interface Props {
  items: RiskCaseListItem[];
  fresh: Set<string>;
  now: number;
}

export function CaseTable({ items, fresh, now }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur [&_td]:px-3 [&_th]:px-3">
      <Table aria-label="Risk cases">
        <THead>
          <tr>
            <TH>Case</TH>
            <TH>Supplier</TH>
            <TH className="hidden xl:table-cell">Event</TH>
            <TH>Severity</TH>
            <TH>Status</TH>
            <TH className="whitespace-nowrap text-right">POs</TH>
            <TH className="text-right">Exposure</TH>
            <TH>Created</TH>
          </tr>
        </THead>
        <TBody>
          {items.map((c) => {
            const isNew = fresh.has(c.id);
            return (
              <TR
                key={c.id}
                className={cn(
                  'h-16 animate-in fade-in-0 duration-300',
                  isNew && 'slide-in-from-left-4 bg-primary/10 ring-2 ring-inset ring-primary',
                )}
              >
                <TD className="relative whitespace-nowrap pl-6">
                  <span
                    aria-hidden="true"
                    className={cn('absolute inset-y-2 left-0 w-1 rounded-r-full', SEV_META[c.severity].bar)}
                  />
                  <Link to={`/risk/${c.id}`} className="font-mono font-medium text-primary hover:underline">
                    {c.id}
                  </Link>
                  {isNew && (
                    <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">
                      New
                    </span>
                  )}
                </TD>
                <TD className="font-medium">{c.supplier_name ?? c.supplier_id}</TD>
                <TD className="hidden whitespace-nowrap xl:table-cell">{eventTypeLabel(c.event_type)}</TD>
                <TD className="whitespace-nowrap">
                  <SeverityBadge severity={c.severity} />
                </TD>
                <TD className="whitespace-nowrap">
                  <StatusBadge status={c.status} />
                </TD>
                <TD className="text-right tabular-nums">{c.affected_po_count}</TD>
                <TD className="whitespace-nowrap text-right font-medium tabular-nums">
                  <Money value={c.exposure} />
                </TD>
                <TD className="whitespace-nowrap text-muted">
                  <time
                    dateTime={c.created_at}
                    title={new Date(c.created_at).toLocaleString()}
                    className="inline-flex items-center gap-1"
                  >
                    {relativeTime(c.created_at, now)}
                  </time>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
