import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Recommendation } from '@/api/types';
import { OPTION_TYPE_LABEL, isUnsupported, moneyNumber } from './format';

interface Row {
  name: string;
  cost: number | null;
  lead: number | null;
  muted: boolean;
}

function Tip({ active, payload, unit }: { active?: boolean; payload?: { payload: Row; value: number }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{p.payload.name}</p>
      <p className="tabular-nums text-muted">
        {p.value.toLocaleString('en-IN')} {unit}
      </p>
    </div>
  );
}

function Mini({ title, rows, field, unit, color }: { title: string; rows: Row[]; field: 'cost' | 'lead'; unit: string; color: string }) {
  const empty = rows.every((r) => r[field] === null);
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      {empty ? (
        <p className="py-8 text-center text-sm text-muted">No data available for any option.</p>
      ) : (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} className="stroke-border/50" strokeDasharray="3 3" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={48} />
              <Tooltip cursor={{ fill: 'hsl(var(--surface-2) / 0.5)' }} content={<Tip unit={unit} />} />
              <Bar dataKey={field} radius={[8, 8, 0, 0]} maxBarSize={44}>
                {rows.map((r) => (
                  <Cell key={r.name} fill={color} fillOpacity={r.muted ? 0.3 : 0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** Cost delta vs lead time per option. Options without data have no bar (never drawn as zero). */
export function ComparisonChart({ recs }: { recs: Recommendation[] }) {
  const rows: Row[] = recs.map((r) => ({
    name: `#${r.rank} ${OPTION_TYPE_LABEL[r.option_type]}`,
    cost: moneyNumber(r.estimated_cost_delta),
    lead: r.estimated_lead_time_days,
    muted: isUnsupported(r),
  }));
  const currency = recs.find((r) => r.estimated_cost_delta)?.estimated_cost_delta?.currency ?? '';
  return (
    <div
      role="img"
      aria-label="Bar charts comparing cost delta and lead time for each option; options with missing data have no bar"
      className="grid gap-6 md:grid-cols-2"
    >
      <Mini title={`Cost delta (${currency || 'n/a'})`} rows={rows} field="cost" unit={currency} color="hsl(var(--primary))" />
      <Mini title="Lead time (days)" rows={rows} field="lead" unit="days" color="#8b5cf6" />
    </div>
  );
}
