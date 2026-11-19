import { useId, useState } from 'react';
import { Badge, Card, CardBody } from '@/components/ui';
import type { Connection } from '@/api/admin/integrations';
import { STATUS_META } from './statusMeta';
import { relativeTime } from './relativeTime';

export function ConnectionCard({ connection: c }: { connection: Connection }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const meta = STATUS_META[c.status];
  return (
    <Card data-testid={`connection-${c.id}`}>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold">{c.name}</h2>
          <Badge tone={meta.tone}>
            <span aria-hidden="true">{meta.icon}</span>
            {meta.label}
          </Badge>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted">Latency</dt>
            <dd>{c.latency_ms === null ? '—' : `${c.latency_ms} ms`}</dd>
          </div>
          <div>
            <dt className="text-muted">Last success</dt>
            <dd>{relativeTime(c.last_success_at)}</dd>
          </div>
        </dl>
        {c.fallback_note && (
          <p className="rounded-md border border-info/30 bg-info/10 p-2 text-sm">{c.fallback_note}</p>
        )}
        {c.last_error && (
          <div>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((o) => !o)}
              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {open ? 'Hide last error' : 'Show last error'}
            </button>
            {open && (
              <div id={panelId} className="mt-2 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm">
                <p className="font-mono text-xs">{c.last_error.code}</p>
                <p>{c.last_error.message}</p>
                <p className="text-xs text-muted">{relativeTime(c.last_error.at)}</p>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
