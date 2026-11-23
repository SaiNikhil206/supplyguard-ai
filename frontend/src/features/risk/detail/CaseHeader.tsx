import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import type { RiskCaseDetail } from '@/api/types';
import { Money, SeverityBadge, StatusBadge } from '@/components/ui';
import { EVENT_ICON, Monogram } from '../ui';
import { CopyButton } from './CopyButton';
import { eventTypeLabel, formatDateTime, STATE_LABELS, stepperSteps } from './format';

const isDanger = (s: string) => s === 'REJECTED' || s === 'EXECUTION_FAILED';

/** Visual horizontal state machine (done / current / upcoming). The accessible list lives in the timeline card. */
function HeroStepper({ status }: { status: RiskCaseDetail['status'] }) {
  const steps = stepperSteps(status);
  const current = steps.indexOf(status);
  return (
    <div aria-hidden="true" className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-center">
        {steps.map((s, i) => {
          const done = i < current;
          const isCurrent = i === current;
          return (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={clsx(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-150',
                    done && 'bg-success text-white',
                    isCurrent && !isDanger(s) && 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2',
                    isCurrent && isDanger(s) && 'bg-danger text-white ring-2 ring-danger/30 ring-offset-2',
                    !done && !isCurrent && 'border border-border bg-card text-muted',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={clsx(
                    'w-24 text-center text-[11px] leading-tight',
                    isCurrent ? 'font-semibold text-foreground' : 'text-muted',
                  )}
                >
                  {STATE_LABELS[s]}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span className={clsx('mb-5 h-0.5 w-6 shrink-0 rounded-full', done ? 'bg-success' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CaseHeader({ detail }: { detail: RiskCaseDetail }) {
  const cid = detail.event.correlation_id;
  const Icon = EVENT_ICON[detail.event_type];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="space-y-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <header className="min-w-0 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              {eventTypeLabel(detail.event_type)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{detail.id}</h1>
              <StatusBadge status={detail.status} />
              <SeverityBadge severity={detail.severity} />
            </div>
            <p className="text-sm text-foreground">{detail.title}</p>
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
              Correlation ID <span className="break-all font-mono">{cid}</span>
              <CopyButton value={cid} label="Copy correlation ID" />
            </p>
          </header>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Supplier</dt>
              <dd className="mt-1 flex items-center gap-2">
                <Monogram name={detail.supplier_name} />
                <Link className="font-medium text-primary hover:underline" to={`/suppliers/${detail.supplier_id}`}>
                  {detail.supplier_name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Exposure</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                <Money value={detail.exposure} />
              </dd>
            </div>
            <div className="col-span-2 text-xs text-muted">
              Created <time dateTime={detail.created_at}>{formatDateTime(detail.created_at)}</time>
              {' · '}Updated <time dateTime={detail.updated_at}>{formatDateTime(detail.updated_at)}</time>
            </div>
          </dl>
        </div>
        <HeroStepper status={detail.status} />
      </div>
    </div>
  );
}
