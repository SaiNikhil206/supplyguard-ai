import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { InventoryGapPoint } from '@/api/whatif';

export function InventoryGapChart({ data }: { data: InventoryGapPoint[] }) {
  const firstShort = data.find((p) => p.on_hand < p.required);
  const worst = data.reduce((m, p) => Math.max(m, p.required - p.on_hand), 0);
  const summary = firstShort
    ? `Inventory falls below requirement on ${firstShort.date}; the largest shortfall is ${worst} units.`
    : 'On-hand inventory stays at or above the requirement for the whole period.';
  // Shaded band = shortfall between on_hand and required (stacked: invisible base + gap).
  const rows = data.map((p) => ({
    ...p,
    base: Math.min(p.on_hand, p.required),
    gap: Math.max(0, p.required - p.on_hand),
  }));
  return (
    <div>
      <p className="sr-only">{summary}</p>
      <div aria-hidden="true" className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area dataKey="base" stackId="g" stroke="none" fill="none" legendType="none" isAnimationActive={false} />
            <Area dataKey="gap" stackId="g" stroke="none" fill="#dc2626" fillOpacity={0.25} name="Gap" isAnimationActive={false} />
            <Line dataKey="on_hand" name="On hand" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="required" name="Required" stroke="#d97706" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
