import { Factory, Truck, ShieldAlert, TrendingDown, Route, type LucideIcon } from 'lucide-react';
import type { EventType, Severity } from '@/api/types';

/** Severity hues: low=emerald, medium=amber, high=orange, critical=rose (via sev-* tokens). */
export const SEV_META: Record<Severity, { bar: string; tint: string; text: string; ring: string; label: string }> = {
  LOW: { bar: 'bg-sev-low', tint: 'bg-sev-low/10', text: 'text-sev-low', ring: 'ring-sev-low/25', label: 'Low' },
  MEDIUM: {
    bar: 'bg-sev-medium',
    tint: 'bg-sev-medium/10',
    text: 'text-sev-medium',
    ring: 'ring-sev-medium/25',
    label: 'Medium',
  },
  HIGH: { bar: 'bg-sev-high', tint: 'bg-sev-high/10', text: 'text-sev-high', ring: 'ring-sev-high/25', label: 'High' },
  CRITICAL: {
    bar: 'bg-sev-critical',
    tint: 'bg-sev-critical/10',
    text: 'text-sev-critical',
    ring: 'ring-sev-critical/25',
    label: 'Critical',
  },
};

export const EVENT_ICON: Record<EventType, LucideIcon> = {
  FACTORY_OUTAGE: Factory,
  SHIPMENT_DELAY: Truck,
  QUALITY_HOLD: ShieldAlert,
  CAPACITY_REDUCTION: TrendingDown,
  LOGISTICS_DISRUPTION: Route,
};

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';
