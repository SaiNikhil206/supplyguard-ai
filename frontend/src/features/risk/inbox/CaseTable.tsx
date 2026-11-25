import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import type { RiskCaseListItem } from '@/api/types';
import { Money, SeverityBadge, StatusBadge, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { cn } from '@/lib/utils';
import { EVENT_ICON, Monogram, SEV_META } from '../ui';
import { eventTypeLabel, relativeTime } from './format';

interface Props {
  items: RiskCaseListItem[];
  fresh: Set<string>;
  now: number;
}

export function CaseTable({ items, fresh, now }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur">
      <Table aria-label="Risk cases">
        <THead>
          <tr>
            <TH>Case</TH>
            <TH>Supplier</TH>
            <TH>Event</TH>
            <TH>Severity</TH>
            <TH>Status</TH>
            <TH className="text-right">Affected POs</TH>
            <TH className="text-right">Exposure</TH>
            <TH>Created</TH>
          </tr>
        </THead>
        <TBody>
          {items.map((c) => {
            const isNew = fresh.has(c.id);
            const Icon = EVENT_ICON[c.event_type];
            return (
              <TR
                key={c.id}
                className={cn(
                  'h-16 animate-in fade-in-0 duration-300',
                  isNew && 'slide-in-from-left-4 bg-primary/10 ring-2 ring-inset ring-primary',
                )}
              >
                <TD className="relative pl-6">
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
                <TD>
                  <span className="flex items-center gap-2.5">
                    <Monogram name={c.supplier_name} />
                    <span className="font-medium">{c.supplier_name}</span>
                  </span>
                </TD>
                <TD>
                  <span className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="h-4 w-4 text-muted" />
                    {eventTypeLabel(c.event_type)}
                  </span>
                </TD>
                <TD>
                  <SeverityBadge severity={c.severity} />
                </TD>
                <TD>
                  <StatusBadge status={c.status} />
                </TD>
                <TD className="text-right tabular-nums">{c.affected_po_count}</TD>
                <TD className="text-right font-medium tabular-nums">
                  <Money value={c.exposure} />
                </TD>
                <TD className="text-muted">
                  <time
                    dateTime={c.created_at}
                    title={new Date(c.created_at).toLocaleString()}
                    className="inline-flex items-center gap-1"
                  >
                    <Clock aria-hidden="true" className="h-3.5 w-3.5" />
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
