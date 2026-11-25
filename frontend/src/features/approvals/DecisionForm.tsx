import { useState, type ReactNode } from 'react';
import { CircleCheck, CircleX, MessageSquareWarning, TriangleAlert } from 'lucide-react';
import { ApiError } from '@/api/client';
import { useDecision } from '@/api/approvals';
import type { ApprovalDecision, RiskCaseDetail } from '@/api/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Money,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { OPTION_LABEL, sortedRecommendations, unsupportedReason } from './format';

export const ROLE_HINT = 'Only procurement managers can approve';

export interface DecisionFormProps {
  riskCase: RiskCaseDetail;
  canDecide: boolean;
  actor: string;
  onNotice: (message: string, tone: 'success' | 'error') => void;
}

const SUCCESS_MESSAGE: Record<ApprovalDecision, string> = {
  APPROVE: 'Approved. Execution started.',
  REJECT: 'Recommendation rejected.',
  REQUEST_CHANGES: 'Changes requested.',
};

const CONFIRM: Record<ApprovalDecision, { title: string; button: string; blurb: string }> = {
  APPROVE: {
    title: 'Approve this recommendation?',
    button: 'Confirm approval',
    blurb: 'The change will be written to the ERP and recorded in the audit trail.',
  },
  REJECT: {
    title: 'Reject this recommendation?',
    button: 'Confirm rejection',
    blurb: 'No ERP change will be made. Your comment is recorded in the audit trail.',
  },
  REQUEST_CHANGES: {
    title: 'Request changes?',
    button: 'Confirm request for changes',
    blurb: 'The case goes back for a revised recommendation. Your comment is sent with it.',
  },
};

/** Disabled buttons never fire hover, so the tooltip hangs off a focusable wrapper. */
function Gated({ reason, children }: { reason: string | null; children: ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

export function DecisionForm({ riskCase, canDecide, actor, onNotice }: DecisionFormProps) {
  const recs = sortedRecommendations(riskCase);
  const firstApprovable = recs.find((r) => !unsupportedReason(r)) ?? recs[0];
  const [selectedId, setSelectedId] = useState(firstApprovable?.id ?? '');
  const [comments, setComments] = useState('');
  const [commentError, setCommentError] = useState('');
  const [serverError, setServerError] = useState('');
  const [confirming, setConfirming] = useState<ApprovalDecision | null>(null);
  const decision = useDecision();

  const selected = recs.find((r) => r.id === selectedId);
  const unsupported = selected ? unsupportedReason(selected) : 'No recommendation to decide on.';
  const disabled = !canDecide || !!unsupported;
  const reason = !canDecide ? ROLE_HINT : unsupported;

  if (recs.length === 0) {
    return (
      <p className="text-sm text-muted">
        {riskCase.no_viable_option_reason ?? 'No recommendations are available for this case yet.'}
      </p>
    );
  }

  /** Step 1: validate, then ask for confirmation. */
  const request = (d: ApprovalDecision) => {
    if (!selected) return;
    if (d !== 'APPROVE' && !comments.trim()) {
      setCommentError('A comment is required to reject or request changes.');
      return;
    }
    setCommentError('');
    setServerError('');
    setConfirming(d);
  };

  /** Step 2: confirmed in the dialog. */
  const submit = (d: ApprovalDecision) => {
    if (!selected) return;
    decision.mutate(
      { caseId: riskCase.id, recommendationId: selected.id, decision: d, comments: comments.trim(), actor },
      {
        onSuccess: () => {
          setConfirming(null);
          onNotice(SUCCESS_MESSAGE[d], 'success');
        },
        onError: (e) => {
          const msg = e instanceof ApiError ? e.message : 'Could not record the decision.';
          setConfirming(null);
          setServerError(msg);
          onNotice(msg, 'error');
        },
      },
    );
  };

  const describedBy = reason ? 'decision-reason' : undefined;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Recommended options</legend>
        {recs.map((r) => {
          const why = unsupportedReason(r);
          return (
            <label
              key={r.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-card p-3 text-sm transition hover:shadow-sm',
                'has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary/40',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                why && 'opacity-70',
              )}
            >
              <input
                type="radio"
                name="option"
                value={r.id}
                checked={selectedId === r.id}
                onChange={() => setSelectedId(r.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-input"
              >
                {selectedId === r.id && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              <span className="space-y-0.5">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  #{r.rank} {OPTION_LABEL[r.option_type]} <span className="font-mono text-xs text-muted">{r.id}</span>
                  {why && <Badge tone="warning">Not approvable</Badge>}
                </span>
                <span className="block text-muted">
                  PO {r.proposed_action.po_id} · lead time{' '}
                  {r.estimated_lead_time_days === null ? 'not available' : `${r.estimated_lead_time_days} d`} · cost delta{' '}
                  <Money value={r.estimated_cost_delta} />
                </span>
                {r.trade_offs[0] && <span className="block text-muted">Trade-off: {r.trade_offs[0]}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="decision-comment" className="block text-sm font-medium">
          Comment
        </label>
        <textarea
          id="decision-comment"
          rows={3}
          value={comments}
          onChange={(e) => {
            setComments(e.target.value);
            if (commentError) setCommentError('');
          }}
          disabled={!canDecide}
          aria-invalid={!!commentError || undefined}
          aria-describedby={commentError ? 'decision-comment-error' : undefined}
          placeholder="Required to reject or request changes"
          className="block w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        {commentError && (
          <p id="decision-comment-error" role="alert" className="text-xs font-medium text-danger">
            {commentError}
          </p>
        )}
      </div>

      {reason && (
        <p id="decision-reason" className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-muted">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          {reason}
        </p>
      )}
      {serverError && (
        <p role="alert" className="text-sm font-medium text-danger">
          {serverError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Gated reason={reason}>
          <Button disabled={disabled} aria-describedby={describedBy} onClick={() => request('APPROVE')}>
            <CircleCheck aria-hidden="true" className="h-4 w-4" />
            Approve
          </Button>
        </Gated>
        <Gated reason={reason}>
          <Button variant="danger" disabled={disabled} aria-describedby={describedBy} onClick={() => request('REJECT')}>
            <CircleX aria-hidden="true" className="h-4 w-4" />
            Reject
          </Button>
        </Gated>
        <Gated reason={reason}>
          <Button
            variant="secondary"
            disabled={disabled}
            aria-describedby={describedBy}
            onClick={() => request('REQUEST_CHANGES')}
          >
            <MessageSquareWarning aria-hidden="true" className="h-4 w-4" />
            Request changes
          </Button>
        </Gated>
      </div>

      <Dialog open={confirming !== null} onOpenChange={(o) => !o && !decision.isPending && setConfirming(null)}>
        {confirming && selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{CONFIRM[confirming].title}</DialogTitle>
              <DialogDescription>{CONFIRM[confirming].blurb}</DialogDescription>
            </DialogHeader>
            <dl className="space-y-2 rounded-xl bg-surface-2/60 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Case</dt>
                <dd className="font-mono">{riskCase.id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Option</dt>
                <dd className="text-right font-medium">
                  #{selected.rank} {OPTION_LABEL[selected.option_type]}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Purchase order</dt>
                <dd className="font-mono">{selected.proposed_action.po_id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Lead time</dt>
                <dd className="tabular-nums">
                  {selected.estimated_lead_time_days === null ? 'Not available' : `${selected.estimated_lead_time_days} days`}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Cost delta</dt>
                <dd>
                  <Money value={selected.estimated_cost_delta} />
                </dd>
              </div>
              <div>
                <dt className="text-muted">Comment</dt>
                <dd className="mt-0.5">{comments.trim() || 'No comment'}</dd>
              </div>
            </dl>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirming(null)} disabled={decision.isPending}>
                Cancel
              </Button>
              <Button
                variant={confirming === 'REJECT' ? 'danger' : 'primary'}
                loading={decision.isPending}
                onClick={() => submit(confirming)}
              >
                {CONFIRM[confirming].button}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
