import { useId } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendPoint } from '@/api/types';
import { ChartTooltip } from '@/components/patterns';
import { compactInr, shortDate } from '@/lib/format';

const hsl = (name: string) => `hsl(var(--${name}))`;
const axisTick = { fill: hsl('muted-text'), fontSize: 12 };
const PRIMARY = 'hsl(var(--primary))';
const AMBER = '#f59e0b';

/** Screen-reader text alternative: latest value and min-max over the period. */
function summarize(data: TrendPoint[], label: string, fmt: (n: number) => string): string {
  if (data.length === 0) return `No ${label} data.`;
  const values = data.map((p) => p.value);
  const last = data[data.length - 1];
  return `${label}: latest ${fmt(last.value)} on ${shortDate(last.date)}; range ${fmt(Math.min(...values))} to ${fmt(Math.max(...values))} from ${shortDate(data[0].date)} to ${shortDate(last.date)}.`;
}

export function ExposureTrendChart({ data }: { data: TrendPoint[] }) {
  const gid = `exp${useId().replace(/:/g, '')}`;
  return (
    <>
      <p className="sr-only">{summarize(data, 'Exposure', compactInr)}</p>
      <div role="img" aria-label="Area chart of exposure over time" className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.4} />
                <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={hsl('border')} strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={compactInr} tick={axisTick} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              cursor={{ stroke: PRIMARY, strokeOpacity: 0.3 }}
              content={<ChartTooltip labelFormatter={shortDate} valueFormatter={compactInr} seriesLabel="Exposure" />}
            />
            <Area type="monotone" dataKey="value" stroke={PRIMARY} strokeWidth={2.5} fill={`url(#${gid})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function CasesTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <>
      <p className="sr-only">{summarize(data, 'Open risk cases', String)}</p>
      <div role="img" aria-label="Bar chart of open risk cases over time" className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={hsl('border')} strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              cursor={{ fill: hsl('surface-2'), fillOpacity: 0.6 }}
              content={<ChartTooltip labelFormatter={shortDate} seriesLabel="Cases" />}
            />
            <Bar dataKey="value" fill={AMBER} radius={[8, 8, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
