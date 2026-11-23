import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { RiskCaseListItem } from '@/api/types';
import { Card, Money, SeverityBadge, StatusBadge, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { cn } from '@/lib/utils';
import { EVENT_ICON, Monogram } from '../ui';
import { eventTypeLabel, relativeTime } from './format';

interface Props {
  items: RiskCaseListItem[];
  fresh: Set<string>;
  now: number;
  /** Footer slot (pagination) rendered inside the card. */
  footer?: ReactNode;
}

export function CaseTable({ items, fresh, now, footer }: Props) {
  const navigate = useNavigate();
  return (
    <Card className="overflow-hidden">
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
            <TH className="w-8">
              <span className="sr-only">Open</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {items.map((c) => {
            const isNew = fresh.has(c.id);
            const Icon = EVENT_ICON[c.event_type];
            return (
              <TR
                key={c.id}
                onClick={() => navigate(`/risk/${c.id}`)}
                className={cn('group cursor-pointer', isNew && 'bg-primary/5 hover:bg-primary/10')}
              >
                <TD className="whitespace-nowrap">
                  <Link
                    to={`/risk/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-xs font-medium text-primary hover:underline"
                  >
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
                  <span className="flex items-center gap-2 text-muted">
                    <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
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
                <TD className="whitespace-nowrap text-xs text-muted">
                  <time dateTime={c.created_at} title={new Date(c.created_at).toLocaleString()}>
                    {relativeTime(c.created_at, now)}
                  </time>
                </TD>
                <TD className="pl-0">
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      {footer}
    </Card>
  );
}
