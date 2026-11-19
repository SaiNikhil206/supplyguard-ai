import { useState } from 'react';
import { ApiError } from '@/api/client';
import { useDecision } from '@/api/approvals';
import type { ApprovalDecision, RiskCaseDetail } from '@/api/types';
import { Badge, Button, Money } from '@/components/ui';
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

export function DecisionForm({ riskCase, canDecide, actor, onNotice }: DecisionFormProps) {
  const recs = sortedRecommendations(riskCase);
  const firstApprovable = recs.find((r) => !unsupportedReason(r)) ?? recs[0];
  const [selectedId, setSelectedId] = useState(firstApprovable?.id ?? '');
  const [comments, setComments] = useState('');
  const [commentError, setCommentError] = useState('');
  const [serverError, setServerError] = useState('');
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

  const submit = (d: ApprovalDecision) => {
    if (!selected) return;
    if (d !== 'APPROVE' && !comments.trim()) {
      setCommentError('A comment is required to reject or request changes.');
      return;
    }
    setCommentError('');
    setServerError('');
    decision.mutate(
      { caseId: riskCase.id, recommendationId: selected.id, decision: d, comments: comments.trim(), actor },
      {
        onSuccess: () => onNotice(SUCCESS_MESSAGE[d], 'success'),
        onError: (e) => {
          const msg = e instanceof ApiError ? e.message : 'Could not record the decision.';
          setServerError(msg);
          onNotice(msg, 'error');
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Recommended options</legend>
        {recs.map((r) => {
          const why = unsupportedReason(r);
          return (
            <label
              key={r.id}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 text-sm has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name="option"
                value={r.id}
                checked={selectedId === r.id}
                onChange={() => setSelectedId(r.id)}
                className="mt-1"
              />
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
          className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        />
        {commentError && (
          <p id="decision-comment-error" role="alert" className="text-xs font-medium text-danger">
            {commentError}
          </p>
        )}
      </div>

      {reason && (
        <p id="decision-reason" className="text-sm text-muted">
          {reason}
        </p>
      )}
      {serverError && (
        <p role="alert" className="text-sm font-medium text-danger">
          {serverError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={disabled}
          loading={decision.isPending}
          aria-describedby={reason ? 'decision-reason' : undefined}
          onClick={() => submit('APPROVE')}
        >
          Approve
        </Button>
        <Button
          variant="danger"
          disabled={disabled || decision.isPending}
          aria-describedby={reason ? 'decision-reason' : undefined}
          onClick={() => submit('REJECT')}
        >
          Reject
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || decision.isPending}
          aria-describedby={reason ? 'decision-reason' : undefined}
          onClick={() => submit('REQUEST_CHANGES')}
        >
          Request changes
        </Button>
      </div>
    </div>
  );
}
