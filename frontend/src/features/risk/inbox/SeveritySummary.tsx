import { OctagonAlert, TriangleAlert, CircleAlert, CircleCheck } from 'lucide-react';
import { useRiskCases } from '@/api/queries';
import type { Severity } from '@/api/types';
import { SEV_META, StatCard } from '../ui';
import { SEVERITIES } from './filterOptions';

const ICON = { CRITICAL: OctagonAlert, HIGH: TriangleAlert, MEDIUM: CircleAlert, LOW: CircleCheck } as const;
const ORDER: Severity[] = [...SEVERITIES].reverse();

function Card({ sev, active, onToggle, pollMs }: { sev: Severity; active: boolean; onToggle: () => void; pollMs: number }) {
  const { data } = useRiskCases({ severity: sev, page_size: 1 }, { refetchInterval: pollMs });
  const m = SEV_META[sev];
  return (
    <StatCard
      icon={ICON[sev]}
      label={m.label}
      value={data ? data.count : '-'}
      hint={data ? (data.count === 1 ? '1 case' : `${data.count} cases`) : 'Loading'}
      tone={`${m.tint} ${m.text}`}
      active={active}
      ariaLabel={m.label}
      onClick={onToggle}
    />
  );
}

/** Four severity counters that double as filters (click again to clear). */
export function SeveritySummary({
  severity,
  onSeverity,
  pollMs,
}: {
  severity: Severity | undefined;
  onSeverity: (s: Severity | undefined) => void;
  pollMs: number;
}) {
  return (
    <div role="group" aria-label="Severity" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {ORDER.map((s) => (
        <Card key={s} sev={s} pollMs={pollMs} active={severity === s} onToggle={() => onSeverity(severity === s ? undefined : s)} />
      ))}
    </div>
  );
}
