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
    icon: string;
    dot: string;
    pill: string;
    stroke: string;
    bar: string;
  }
> = {
  UP: {
    label: "Up",
    tone: "success",
    icon: "✓",
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
    stroke: "#10b981",
    bar: "bg-emerald-500",
  },
  DEGRADED: {
    label: "Degraded",
    tone: "warning",
    icon: "!",
    dot: "bg-amber-500",
    pill: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
    stroke: "#f59e0b",
    bar: "bg-amber-500",
  },
  DOWN: {
    label: "Down",
    tone: "danger",
    icon: "✕",
    dot: "bg-rose-500",
    pill: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400",
    stroke: "#f43f5e",
    bar: "bg-rose-500",
  },
  FALLBACK: {
    label: "Fallback",
    tone: "info",
    icon: "↺",
    dot: "bg-sky-500",
    pill: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
    stroke: "#0ea5e9",
    bar: "bg-sky-500",
  },
};

/** Two-letter monogram + gradient per Boomi service. */
export const KIND_META: Record<
  ConnectionKind,
  { mono: string; gradient: string; sub: string }
> = {
  BOOMI_INTEGRATION: {
    mono: "BI",
    gradient: "from-indigo-500 to-blue-600",
    sub: "Integration",
  },
  EVENT_STREAMS: {
    mono: "ES",
    gradient: "from-sky-500 to-cyan-600",
    sub: "Event Streams",
  },
  AGENTSTUDIO: {
    mono: "AS",
    gradient: "from-violet-500 to-fuchsia-600",
    sub: "AI agents",
  },
  FLOW: {
    mono: "FL",
    gradient: "from-emerald-500 to-teal-600",
    sub: "Approvals",
  },
  API_MANAGEMENT: {
    mono: "AM",
    gradient: "from-amber-500 to-orange-600",
    sub: "API gateway",
  },
  MOCK_ERP: {
    mono: "ER",
    gradient: "from-rose-500 to-pink-600",
    sub: "Mock ERP",
  },
  DATABASE: {
    mono: "DB",
    gradient: "from-slate-500 to-slate-700",
    sub: "PostgreSQL",
  },
};
