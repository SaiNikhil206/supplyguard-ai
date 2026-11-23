import type { RiskLevel, Supplier } from '@/api/types';

export const LEVEL_BAR: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-rose-500',
};

export const LEVEL_SOFT: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  MEDIUM: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
  HIGH: 'bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-400',
  CRITICAL: 'bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400',
};

const GRADS = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-fuchsia-500 to-pink-500',
  'from-amber-500 to-orange-500',
];

export function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function gradFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADS[h % GRADS.length];
}

const FLAGS: Record<string, string> = {
  india: '🇮🇳', china: '🇨🇳', germany: '🇩🇪', usa: '🇺🇸', 'united states': '🇺🇸', japan: '🇯🇵', vietnam: '🇻🇳',
  taiwan: '🇹🇼', 'south korea': '🇰🇷', mexico: '🇲🇽', 'united kingdom': '🇬🇧', uk: '🇬🇧', france: '🇫🇷', italy: '🇮🇹',
  thailand: '🇹🇭', indonesia: '🇮🇩', brazil: '🇧🇷', turkey: '🇹🇷', poland: '🇵🇱', singapore: '🇸🇬', malaysia: '🇲🇾',
};

export const flagFor = (country: string): string => FLAGS[country.trim().toLowerCase()] ?? '🌐';

/** Count of suppliers per risk level. */
export function countByLevel(suppliers: Supplier[] | undefined): Record<RiskLevel, number> {
  const out: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const s of suppliers ?? []) out[s.risk_level] += 1;
  return out;
}

