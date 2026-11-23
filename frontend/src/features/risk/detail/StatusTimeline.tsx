import clsx from 'clsx';
import type { RiskCaseState, TimelineEntry } from '@/api/types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui';
import { formatDateTime, STATE_LABELS, stepperSteps } from './format';

const isDanger = (s: RiskCaseState) => s === 'REJECTED' || s === 'EXECUTION_FAILED';

export function StatusStepper({ status }: { status: RiskCaseState }) {
  const steps = stepperSteps(status);
  const current = steps.indexOf(status);
  return (
    <ol aria-label="Case state path" className="sr-only">
      {steps.map((s, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <li
            key={s}
            aria-current={isCurrent ? 'step' : undefined}
            data-step-state={isCurrent ? 'current' : done ? 'done' : 'upcoming'}
            className={clsx(
              'rounded-full border px-2 py-0.5',
              isCurrent && isDanger(s) && 'border-danger bg-danger/15 font-semibold text-danger',
              isCurrent && !isDanger(s) && 'border-primary bg-primary/10 font-semibold text-foreground',
              done && 'border-success/40 bg-success/10 text-success',
              !done && !isCurrent && 'border-border text-muted',
            )}
          >
            {STATE_LABELS[s]}
          </li>
        );
      })}
    </ol>
  );
}

export function StatusTimeline({ status, timeline }: { status: RiskCaseState; timeline: TimelineEntry[] }) {
  const sorted = [...timeline].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <Card className="overflow-hidden" role="region" aria-labelledby="timeline-heading">
      <CardHeader>
        <CardTitle id="timeline-heading">Status timeline</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <StatusStepper status={status} />
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">No activity yet</p>
        ) : (
          <ol aria-label="Timeline" className="relative space-y-5 border-l border-border pl-5">
            {sorted.map((t, i) => {
              const current = i === sorted.length - 1;
              return (
                <li key={`${t.at}-${i}`} data-current={current || undefined} className="relative text-sm">
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card',
                      current ? (isDanger(status) ? 'bg-danger' : 'bg-primary') : 'bg-border',
                    )}
                  />
                  <time dateTime={t.at} className="block text-xs text-muted">
                    {formatDateTime(t.at)}
                  </time>
                  <p className={clsx('font-medium', current ? 'text-foreground' : 'text-foreground/90')}>
                    {t.action.replace(/_/g, ' ').toLowerCase()}
                    <span className="font-normal text-muted"> · {t.actor}</span>
                  </p>
                  {t.detail && <p className="text-muted">{t.detail}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
