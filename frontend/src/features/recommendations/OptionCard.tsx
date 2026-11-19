import type { ReactNode } from 'react';
import { Badge, Card, CardBody, CardHeader, CardTitle, EvidenceTag, Money } from '@/components/ui';
import type { EvidenceRef, Recommendation } from '@/api/types';
import { OPTION_TYPE_LABEL, describeAction, isUnsupported } from './format';

function EvidenceItem({ e }: { e: EvidenceRef }) {
  return (
    <li className="text-xs">
      <span className="font-mono">
        {e.source} · {e.entity} · {e.field}
      </span>
      {': '}
      {e.value === null ? <em>missing</em> : <span>{String(e.value)}</span>}
    </li>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

const NotAvailable = () => (
  <span className="inline-flex items-center gap-2">
    <span>Not available</span> <EvidenceTag kind="MISSING_DATA" />
  </span>
);

function List({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (items.length === 0) return null;
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <section>
      <h4 className="text-sm font-semibold">{title}</h4>
      <Tag className={ordered ? 'list-decimal pl-5 text-sm' : 'list-disc pl-5 text-sm'}>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </Tag>
    </section>
  );
}

export function OptionCard({ rec }: { rec: Recommendation }) {
  const unsupported = isUnsupported(rec);
  const title = `Option ${rec.rank}: ${OPTION_TYPE_LABEL[rec.option_type]}`;
  return (
    <Card role="article" aria-label={title} data-rank={rec.rank}>
      <CardHeader>
        <CardTitle>
          #{rec.rank} · {OPTION_TYPE_LABEL[rec.option_type]}
        </CardTitle>
        <span className="font-mono text-xs text-muted">{rec.id}</span>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-sm font-medium">{describeAction(rec)}</p>
        {unsupported && (
          <p role="note" className="rounded border-2 border-danger px-2 py-1 text-sm font-semibold text-danger">
            ⚠ Not supported by data — cannot be approved
          </p>
        )}
        <dl className="grid grid-cols-2 gap-3">
          <Metric label="Lead time">
            {rec.estimated_lead_time_days === null ? <NotAvailable /> : `${rec.estimated_lead_time_days} days`}
          </Metric>
          <Metric label="Cost delta">
            {rec.estimated_cost_delta === null ? <NotAvailable /> : <Money value={rec.estimated_cost_delta} />}
          </Metric>
        </dl>
        {rec.data_gaps.length > 0 && (
          <div className="rounded border border-danger/50 bg-danger/10 p-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              Data gaps <EvidenceTag kind="MISSING_DATA" />
            </h4>
            <ul className="list-disc pl-5 text-sm">
              {rec.data_gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}
        <List title="Trade-offs" items={rec.trade_offs} />
        <List title="Action steps" items={rec.action_steps} ordered />
        {rec.assumptions.length > 0 && (
          <section>
            <h4 className="text-sm font-semibold">Assumptions</h4>
            <ul className="space-y-1 text-sm">
              {rec.assumptions.map((a) => (
                <li key={a} className="flex items-start gap-2">
                  <EvidenceTag kind="ASSUMPTION" /> <span>{a}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h4 className="text-sm font-semibold">Evidence</h4>
          {rec.evidence.length === 0 ? (
            <p className="text-xs text-muted">No evidence attached.</p>
          ) : (
            <ul className="space-y-0.5">
              {rec.evidence.map((e, i) => (
                <EvidenceItem key={i} e={e} />
              ))}
            </ul>
          )}
        </section>
        {unsupported && <Badge tone="danger">Unsupported</Badge>}
      </CardBody>
    </Card>
  );
}
