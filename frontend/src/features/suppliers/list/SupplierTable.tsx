import { Link } from 'react-router-dom';
import type { Supplier } from '@/api/types';
import { Badge, SeverityBadge, TBody, TD, TH, THead, TR, Table } from '@/components/ui';
import { SUPPLIER_STATUS } from '../status';

const HEADERS = ['Supplier', 'Country', 'Category', 'Status', 'Risk', 'Open POs', 'On-time %'];
const RISK_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function SupplierTable({ suppliers, loading }: { suppliers?: Supplier[]; loading?: boolean }) {
  return (
    <Table aria-label="Suppliers" aria-busy={loading || undefined}>
      <THead>
        <tr>
          {HEADERS.map((h, i) => (
            <TH key={h} className={i >= 5 ? 'text-right' : undefined}>
              {h}
            </TH>
          ))}
        </tr>
      </THead>
      <TBody>
        {loading
          ? Array.from({ length: 6 }, (_, r) => (
              <TR key={r} data-testid="skeleton-row">
                {HEADERS.map((h) => (
                  <TD key={h}>
                    <div className="h-4 w-full max-w-[8rem] animate-pulse rounded bg-surface-2" />
                  </TD>
                ))}
              </TR>
            ))
          : [...(suppliers ?? [])]
              .sort((a, b) => RISK_ORDER.indexOf(b.risk_level) - RISK_ORDER.indexOf(a.risk_level) || a.id.localeCompare(b.id))
              .map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link to={`/suppliers/${s.id}`} className="font-medium text-primary hover:underline">
                      {s.name}
                    </Link>
                    <div className="font-mono text-xs text-muted">{s.id}</div>
                  </TD>
                  <TD>{s.country}</TD>
                  <TD>{s.category}</TD>
                  <TD>
                    <Badge tone={SUPPLIER_STATUS[s.status]?.tone ?? 'neutral'}>
                      {SUPPLIER_STATUS[s.status]?.label ?? s.status}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={s.risk_level} />
                      {s.risk_score != null && <span className="tabular-nums text-muted">{s.risk_score}</span>}
                    </div>
                  </TD>
                  <TD className="text-right tabular-nums">{s.open_po_count}</TD>
                  <TD className="text-right tabular-nums">{s.on_time_delivery_pct}%</TD>
                </TR>
              ))}
      </TBody>
    </Table>
  );
}
