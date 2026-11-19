import { Link } from 'react-router-dom';
import { Table, TBody, TD, TH, THead, TR, TableEmptyRow } from '@/components/ui';
import type { AuditEvent } from '@/api/admin/audit';
import { formatTime } from './stages';

export function EntityCell({ e }: { e: AuditEvent }) {
  if (e.entity_type === 'RISK_CASE') {
    return (
      <Link to={`/risk/${e.entity_id}`} className="text-primary underline">
        {e.entity_id}
      </Link>
    );
  }
  return (
    <span>
      {e.entity_type} {e.entity_id}
    </span>
  );
}

export function AuditTable({
  events,
  onTrace,
}: {
  events: AuditEvent[];
  onTrace: (correlationId: string) => void;
}) {
  return (
    <Table aria-label="Audit events">
      <THead>
        <TR>
          <TH>Time</TH>
          <TH>Actor</TH>
          <TH>Entity</TH>
          <TH>Action</TH>
          <TH>State change</TH>
          <TH>Correlation ID</TH>
        </TR>
      </THead>
      <TBody>
        {events.length === 0 && <TableEmptyRow colSpan={6}>No audit events match</TableEmptyRow>}
        {events.map((e) => (
          <TR key={e.id}>
            <TD className="whitespace-nowrap font-mono text-xs">{formatTime(e.at)}</TD>
            <TD>
              {e.actor.name} <span className="text-xs text-muted">({e.actor.type})</span>
            </TD>
            <TD>
              <EntityCell e={e} />
            </TD>
            <TD>{e.action}</TD>
            <TD>{e.from_state || e.to_state ? `${e.from_state ?? '-'} → ${e.to_state ?? '-'}` : '-'}</TD>
            <TD>
              <button
                type="button"
                className="font-mono text-xs text-primary underline"
                onClick={() => onTrace(e.correlation_id)}
                aria-label={`Trace ${e.correlation_id}`}
              >
                {e.correlation_id.slice(0, 8)}…
              </button>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
