import type { AuditEntityType, AuditEvent } from '@/api/admin/audit';

export const STAGES = ['Event', 'Analysis', 'Approval', 'Execution'] as const;
export type Stage = (typeof STAGES)[number];

const STAGE_OF: Partial<Record<AuditEntityType, Stage>> = {
  EVENT: 'Event',
  RISK_CASE: 'Analysis',
  ANALYSIS: 'Analysis',
  RECOMMENDATION: 'Analysis',
  APPROVAL: 'Approval',
  EXECUTION: 'Execution',
};

export function stageOf(e: AuditEvent): Stage | null {
  return STAGE_OF[e.entity_type] ?? null;
}

export interface StageGroup {
  stage: Stage;
  events: AuditEvent[];
}

/** Events sorted oldest first, grouped into the four fixed stages (empty groups kept). */
export function groupByStage(events: AuditEvent[]): { groups: StageGroup[]; other: AuditEvent[] } {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const groups: StageGroup[] = STAGES.map((stage) => ({ stage, events: [] }));
  const other: AuditEvent[] = [];
  for (const e of sorted) {
    const s = stageOf(e);
    if (s) groups.find((g) => g.stage === s)?.events.push(e);
    else other.push(e);
  }
  return { groups, other };
}

export const AUDIT_ACTIONS = ['CREATED', 'DECIDED', 'RECEIVED', 'RESULT', 'STORED', 'TRANSITION', 'UPDATED'];

export function formatTime(iso: string): string {
  return iso.replace('T', ' ').replace(/:\d\dZ$/, 'Z').replace(/Z$/, ' UTC');
}
