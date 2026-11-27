import type { ApprovalDecision, ExecutionStatus, OptionType, Recommendation, RiskCaseDetail } from '@/api/types';

export const OPTION_LABEL: Record<OptionType, string> = {
  ALTERNATE_SUPPLIER: 'Alternate supplier',
  INVENTORY_TRANSFER: 'Inventory transfer',
  REVISED_SCHEDULE: 'Revised schedule',
  SPLIT_ORDER: 'Split order',
};

export const DECISION_LABEL: Record<ApprovalDecision, string> = {
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  REQUEST_CHANGES: 'Changes requested',
};

export const EXECUTION_LABEL: Record<ExecutionStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
};

export const NOT_APPROVABLE = 'This option cannot be approved because the data does not support an estimate';

/** Reason an option cannot be approved, or null. Mirrors the backend BUSINESS_RULE check (PROVISIONAL). */
export function unsupportedReason(rec: Recommendation): string | null {
  if (rec.unsupported) {
    const why = rec.unsupported_reasons?.[0]?.message ?? rec.data_gaps[0];
    return why ? `${NOT_APPROVABLE}: ${why}` : `${NOT_APPROVABLE}.`;
  }
  if (rec.estimated_lead_time_days === null || rec.estimated_cost_delta === null) {
    return rec.data_gaps[0] ? `${NOT_APPROVABLE}: ${rec.data_gaps[0]}` : `${NOT_APPROVABLE}.`;
  }
  return null;
}

export function sortedRecommendations(c: RiskCaseDetail): Recommendation[] {
  return [...c.recommendations].sort((a, b) => a.rank - b.rank);
}

/** "2d 4h", "35m", "just now". Future timestamps (clock skew / fixtures) count as just now. */
export function waitingTime(from: string, now = Date.now()): string {
  const mins = Math.floor((now - new Date(from).getTime()) / 60_000);
  if (!Number.isFinite(mins) || mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
