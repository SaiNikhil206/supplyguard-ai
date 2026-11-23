import type { BadgeTone } from "@/components/ui";
import type {
  ConnectionKind,
  ConnectionStatus,
} from "@/api/admin/integrations";

export const STATUS_META: Record<
  ConnectionStatus,
  {
    label: string;
    tone: BadgeTone;
    dot: string;
    pill: string;
    bar: string;
  }
> = {
  UP: {
    label: "Up",
    tone: "success",
    dot: "bg-success",
    pill: "bg-success/10 text-success ring-success/20",
    bar: "bg-success",
  },
  DEGRADED: {
    label: "Degraded",
    tone: "warning",
    dot: "bg-warning",
    pill: "bg-warning/10 text-warning ring-warning/25",
    bar: "bg-warning",
  },
  DOWN: {
    label: "Down",
    tone: "danger",
    dot: "bg-danger",
    pill: "bg-danger/10 text-danger ring-danger/20",
    bar: "bg-danger",
  },
  FALLBACK: {
    label: "Fallback",
    tone: "info",
    dot: "bg-info",
    pill: "bg-info/10 text-info ring-info/20",
    bar: "bg-info",
  },
};

/** Two-letter monogram + sub label per Boomi service (neutral tile, no per-service colour). */
export const KIND_META: Record<ConnectionKind, { mono: string; sub: string }> = {
  BOOMI_INTEGRATION: { mono: "BI", sub: "Integration" },
  EVENT_STREAMS: { mono: "ES", sub: "Event Streams" },
  AGENTSTUDIO: { mono: "AS", sub: "AI agents" },
  FLOW: { mono: "FL", sub: "Approvals" },
  API_MANAGEMENT: { mono: "AM", sub: "API gateway" },
  MOCK_ERP: { mono: "ER", sub: "Mock ERP" },
  DATABASE: { mono: "DB", sub: "PostgreSQL" },
};
