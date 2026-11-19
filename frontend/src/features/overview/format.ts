import type { TrendPoint } from '@/api/types';

/** Compact INR for axis ticks: 4500000 -> ₹45L, 25000000 -> ₹2.5Cr. */
export function compactInr(n: number): string {
  const abs = Math.abs(n);
  const trim = (x: number) => String(Number(x.toFixed(1)));
  if (abs >= 1e7) return `₹${trim(n / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${trim(n / 1e5)}L`;
  if (abs >= 1e3) return `₹${trim(n / 1e3)}K`;
  return `₹${trim(n)}`;
}

/** "2026-11-30" -> "30 Nov" (UTC, no timezone drift). */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export const hasTrend = (t: TrendPoint[] | undefined) => !!t && t.length > 0;
