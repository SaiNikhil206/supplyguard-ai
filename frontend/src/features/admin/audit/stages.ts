import { sortOldestFirst, type AuditEvent } from "@/api/admin/audit";

export const STAGES = ["Event", "Analysis", "Approval", "Execution"] as const;
export type Stage = (typeof STAGES)[number];

const ANALYSIS_STATES = ["ANALYZING", "RECOMMENDATION_READY", "PENDING_APPROVAL"];
const APPROVAL_STATES = ["APPROVED", "REJECTED"];
const EXECUTION_STATES = ["EXECUTING", "RECOVERED", "EXECUTION_FAILED"];

/**
 * Map a real audit row to a trace stage. Approvals are recorded as `recommendation.decided`,
 * and case moves as `risk_case.status_changed` with data.to (CONTRACTS section 7).
 */
export function stageOf(e: AuditEvent): Stage | null {
  const a = e.action;
  if (e.entity_type === "DisruptionEvent" || a.startsWith("event.")) return "Event";
  if (a === "recommendation.decided" || a.startsWith("approval.")) return "Approval";
  if (e.entity_type === "Execution" || a.startsWith("execution.")) return "Execution";
  if (a.startsWith("analysis.") || a === "risk_case.created") return "Analysis";
  if (a === "risk_case.status_changed") {
    const to = e.to_state ?? "";
    if (ANALYSIS_STATES.includes(to)) return "Analysis";
    if (APPROVAL_STATES.includes(to)) return "Approval";
    if (EXECUTION_STATES.includes(to)) return "Execution";
  }
  return null;
}

export interface StageGroup {
  stage: Stage;
  events: AuditEvent[];
}

/** Events sorted oldest first, grouped into the four fixed stages (empty groups kept). */
export function groupByStage(events: AuditEvent[]): {
  groups: StageGroup[];
  other: AuditEvent[];
} {
  const sorted = sortOldestFirst(events);
  const groups: StageGroup[] = STAGES.map((stage) => ({ stage, events: [] }));
  const other: AuditEvent[] = [];
  for (const e of sorted) {
    const s = stageOf(e);
    if (s) groups.find((g) => g.stage === s)?.events.push(e);
    else other.push(e);
  }
  return { groups, other };
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function formatGap(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400)
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}
