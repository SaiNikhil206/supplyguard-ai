import type { ReactNode } from 'react';
import { ArrowLeftRight, Clock, Crown, Database, TriangleAlert, Wallet } from 'lucide-react';
import { Badge, EvidenceTag, Money } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { EvidenceRef, Recommendation } from '@/api/types';
import { OPTION_TYPE_LABEL, describeAction, isUnsupported } from './format';

function EvidenceItem({ e }: { e: EvidenceRef }) {
  return (
    <li className="flex items-start gap-1.5 text-xs">
      <Database aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" />
      <span>
        <span className="font-mono">
          {e.source} · {e.entity} · {e.field}
        </span>
        {': '}
        {e.value === null ? <em>missing</em> : <span>{String(e.value)}</span>}
      </span>
    </li>
  );
}

function Metric({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2/60 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{children}</dd>
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
      <h4 className="mb-1 text-sm font-semibold">{title}</h4>
      <Tag className={ordered ? 'list-decimal space-y-0.5 pl-5 text-sm' : 'list-disc pl-5 text-sm'}>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </Tag>
    </section>
  );
}

const MEDAL = ['', 'bg-amber-400/20 text-amber-600', 'bg-slate-400/20 text-slate-500', 'bg-orange-700/15 text-orange-700'];

export function OptionCard({ rec }: { rec: Recommendation }) {
  const unsupported = isUnsupported(rec);
  const top = rec.rank === 1 && !unsupported;
  const title = `Option ${rec.rank}: ${OPTION_TYPE_LABEL[rec.option_type]}`;
  return (
    <div
      className={cn(
        'rounded-2xl p-px transition',
        top ? 'bg-primary' : 'bg-border/60',
        unsupported && 'opacity-60 saturate-50 hover:opacity-90',
      )}
    >
      <article
        aria-label={title}
        data-rank={rec.rank}
        className="h-full space-y-4 rounded-[15px] bg-card p-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
      >
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold',
                MEDAL[rec.rank] ?? 'bg-surface-2 text-muted',
              )}
            >
              {top ? <Crown aria-hidden="true" className="h-4 w-4" /> : `#${rec.rank}`}
            </span>
            <h3 className="text-base font-semibold">
              #{rec.rank} · {OPTION_TYPE_LABEL[rec.option_type]}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {top && (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                Recommended
              </span>
            )}
            <span className="font-mono text-xs text-muted">{rec.id}</span>
          </div>
        </header>
        <p className="text-sm font-medium">{describeAction(rec)}</p>
        {unsupported && (
          <div role="note" className="flex items-start gap-2 rounded-xl border-2 border-danger/60 bg-danger/5 p-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div className="text-sm">
              <p className="font-semibold text-danger">Not supported by data — cannot be approved</p>
              <p className="text-muted">
                The cost or lead-time estimate for this option is missing source data, so it is shown dimmed and cannot be
                approved until the gaps below are filled.
              </p>
            </div>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3">
          <Metric icon={<Clock aria-hidden="true" className="h-3.5 w-3.5" />} label="Lead time">
            {rec.estimated_lead_time_days === null ? <NotAvailable /> : `${rec.estimated_lead_time_days} days`}
          </Metric>
          <Metric icon={<Wallet aria-hidden="true" className="h-3.5 w-3.5" />} label="Cost delta">
            {rec.estimated_cost_delta === null ? <NotAvailable /> : <Money value={rec.estimated_cost_delta} />}
          </Metric>
        </dl>
        {rec.data_gaps.length > 0 && (
          <div className="rounded-xl border border-danger/50 bg-danger/10 p-3">
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
        {rec.trade_offs.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-sm font-semibold">Trade-offs</h4>
            <ul className="flex flex-wrap gap-1.5">
              {rec.trade_offs.map((t) => (
                <li
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs ring-1 ring-border"
                >
                  <ArrowLeftRight aria-hidden="true" className="h-3 w-3 text-muted" />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        )}
        <List title="Action steps" items={rec.action_steps} ordered />
        {rec.assumptions.length > 0 && (
          <section>
            <h4 className="mb-1 text-sm font-semibold">Assumptions</h4>
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
          <h4 className="mb-1 text-sm font-semibold">Evidence</h4>
          {rec.evidence.length === 0 ? (
            <p className="text-xs text-muted">No evidence attached.</p>
          ) : (
            <ul className="space-y-1">
              {rec.evidence.map((e, i) => (
                <EvidenceItem key={i} e={e} />
              ))}
            </ul>
          )}
        </section>
        {unsupported && <Badge tone="danger">Unsupported</Badge>}
      </article>
    </div>
  );
}
