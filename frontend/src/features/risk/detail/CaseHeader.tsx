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
    <ol aria-hidden="true" className="flex w-full items-start">
      {steps.map((s, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <li key={s} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
            {i > 0 && (
              <span className={clsx('absolute left-0 right-1/2 top-3 h-0.5', i <= current ? 'bg-success' : 'bg-border')} />
            )}
            {i < steps.length - 1 && (
              <span className={clsx('absolute left-1/2 right-0 top-3 h-0.5', done ? 'bg-success' : 'bg-border')} />
            )}
            <span
              className={clsx(
                'relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                done && 'bg-success text-white',
                isCurrent && !isDanger(s) && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                isCurrent && isDanger(s) && 'bg-danger text-white ring-4 ring-danger/20',
                !done && !isCurrent && 'border border-border bg-card text-muted',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={clsx(
                'px-0.5 text-center text-[11px] leading-tight',
                isCurrent ? 'font-semibold text-foreground' : 'text-muted',
              )}
            >
              {STATE_LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CaseHeader({ detail }: { detail: RiskCaseDetail }) {
  const cid = detail.event.correlation_id;
  const Icon = EVENT_ICON[detail.event_type];
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur duration-300">
      <div className="space-y-6 p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <header className="min-w-0 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {eventTypeLabel(detail.event_type)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-3xl font-semibold tracking-tight">{detail.id}</h1>
              <StatusBadge status={detail.status} />
              <SeverityBadge severity={detail.severity} />
            </div>
            <p className="text-sm">{detail.title}</p>
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
              Correlation ID <span className="break-all font-mono">{cid}</span>
              <CopyButton value={cid} label="Copy correlation ID" />
            </p>
          </header>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Supplier</dt>
              <dd className="mt-1 flex items-center gap-2">
                <Monogram name={detail.supplier_name ?? detail.supplier_id} className="h-8 w-8" />
                <Link className="font-medium text-primary hover:underline" to={`/suppliers/${detail.supplier_id}`}>
                  {detail.supplier_name ?? detail.supplier_id}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Exposure</dt>
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
