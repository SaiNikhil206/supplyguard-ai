import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts';
import type { RiskLevel } from '@/api/types';

const COLOR: Record<RiskLevel, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#f43f5e',
};

/** Radial 0-100 risk gauge exposed as an accessible meter. */
export function RiskGauge({ score, level }: { score?: number | null; level: RiskLevel }) {
  if (score == null) return null;
  const v = Math.max(0, Math.min(100, score));
  return (
    <div
      role="meter"
      aria-label="Risk score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-valuetext={`${v} out of 100`}
      className="relative h-36 w-36 shrink-0"
    >
      <RadialBarChart
        width={144}
        height={144}
        innerRadius="76%"
        outerRadius="100%"
        data={[{ name: 'risk', value: v, fill: COLOR[level] }]}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" cornerRadius={12} background={{ fill: 'hsl(var(--border))', fillOpacity: 0.5 }} />
      </RadialBarChart>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums tracking-tight">{v}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted">of 100</span>
      </div>
    </div>
  );
}
