import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Supplier } from '@/api/types';
import { Badge, SeverityBadge, TBody, TD, TH, THead, TR, Table } from '@/components/ui';
import { cn } from '@/lib/utils';
import { SUPPLIER_STATUS } from '../status';
import { RiskBar, SupplierMonogram } from './parts';
import { LEVEL_BAR, flagFor } from './risk';

const HEADERS = ['Supplier', 'Country', 'Category', 'Status', 'Risk', 'Open POs', 'On-time %'];

function OnTime({ pct }: { pct: number }) {
  const tone = pct >= 90 ? 'LOW' : pct >= 75 ? 'MEDIUM' : 'CRITICAL';
  return (
    <div className="ml-auto flex w-28 items-center gap-2">
      <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
        <span className={cn('block h-full rounded-full', LEVEL_BAR[tone])} style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      <span className="tabular-nums">{pct}%</span>
    </div>
  );
}

export function SupplierTable({ suppliers, loading }: { suppliers?: Supplier[]; loading?: boolean }) {
  const navigate = useNavigate();
  return (
    <Table aria-label="Suppliers" aria-busy={loading || undefined}>
      <THead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
        <tr>
          {HEADERS.map((h, i) => (
            <TH key={h} className={cn('text-xs uppercase tracking-wide text-muted', i >= 5 && 'text-right')}>
              {h}
            </TH>
          ))}
          <TH className="w-12">
            <span className="sr-only">Actions</span>
          </TH>
        </tr>
      </THead>
      <TBody>
        {loading
          ? Array.from({ length: 6 }, (_, r) => (
              <TR key={r} data-testid="skeleton-row" className="h-14">
                {HEADERS.map((h, i) => (
                  <TD key={h}>
                    {i === 0 ? (
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-surface-2" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-32 animate-pulse rounded bg-surface-2" />
                          <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-4 w-full max-w-[6rem] animate-pulse rounded bg-surface-2" />
                    )}
                  </TD>
                ))}
                <TD />
              </TR>
            ))
          : [...(suppliers ?? [])]
              .sort((a, b) => b.risk_score - a.risk_score)
              .map((s) => (
                <TR key={s.id} className="group h-14">
                  <TD>
                    <div className="flex items-center gap-3">
                      <SupplierMonogram name={s.name} level={s.risk_level} />
                      <div className="min-w-0">
                        <Link to={`/suppliers/${s.id}`} className="block truncate font-medium text-foreground hover:text-primary hover:underline">
                          {s.name}
                        </Link>
                        <div className="font-mono text-xs text-muted">{s.id}</div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-0.5 text-xs">
                      <span aria-hidden="true">{flagFor(s.country)}</span>
                      {s.country}
                    </span>
                  </TD>
                  <TD className="text-muted">{s.category}</TD>
                  <TD>
                    <Badge tone={SUPPLIER_STATUS[s.status]?.tone ?? 'neutral'}>
                      {SUPPLIER_STATUS[s.status]?.label ?? s.status}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex flex-col gap-1.5">
                      <SeverityBadge severity={s.risk_level} className="w-fit" />
                      <RiskBar score={s.risk_score} level={s.risk_level} className="w-28" />
                    </div>
                  </TD>
                  <TD className="text-right tabular-nums">{s.open_po_count}</TD>
                  <TD className="text-right">
                    <OnTime pct={s.on_time_delivery_pct} />
                  </TD>
                  <TD className="text-right">
                    <button
                      type="button"
                      aria-label={`Open ${s.name}`}
                      onClick={() => navigate(`/suppliers/${s.id}`)}
                      className="rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover:opacity-100"
                    >
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </TD>
                </TR>
              ))}
      </TBody>
    </Table>
  );
}
