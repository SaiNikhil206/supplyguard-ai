import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Check,
  Copy,
  Cpu,
  GitBranch,
  User,
} from "lucide-react";
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableEmptyRow,
  toast,
} from "@/components/ui";
import type { AuditEvent } from "@/api/admin/audit";
import { cn } from "@/lib/utils";
import { formatTime } from "./stages";

const ACTOR = {
  USER: { icon: User, cls: "bg-foreground/5 text-muted", label: "User" },
  SYSTEM: {
    icon: Cpu,
    cls: "bg-foreground/5 text-muted",
    label: "System",
  },
  AGENT: {
    icon: Bot,
    cls: "bg-foreground/5 text-muted",
    label: "AI agent",
  },
} as const;

export function ActorCell({ actor }: { actor: AuditEvent["actor"] }) {
  const m = ACTOR[actor.type] ?? ACTOR.SYSTEM;
  const Icon = m.icon;
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          m.cls,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-medium">{actor.name}</div>
        <div className="text-xs text-muted">({actor.type})</div>
      </div>
    </div>
  );
}

export function EntityCell({ e }: { e: AuditEvent }) {
  const chip =
    "rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted";
  if (e.entity_type === "RISK_CASE") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span className={chip} aria-hidden="true">
          Case
        </span>
        <Link
          to={`/risk/${e.entity_id}`}
          className="text-primary underline-offset-2 hover:underline"
        >
          {e.entity_id}
        </Link>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={chip}>{e.entity_type}</span>
      <span className="font-mono text-xs">{e.entity_id}</span>
    </span>
  );
}

export function StateChange({
  from,
  to,
}: {
  from: string | null;
  to: string | null;
}) {
  if (!from && !to) return <span className="text-muted">-</span>;
  const chip =
    "rounded-md border border-border/60 bg-surface-2 px-1.5 py-0.5 text-xs font-medium";
  return (
    <span
      className="inline-flex flex-wrap items-center gap-1"
      aria-label={`${from ?? "-"} to ${to ?? "-"}`}
    >
      <span className={chip}>{from ?? "-"}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      <span
        className={cn(chip, "bg-foreground/5 text-foreground")}
      >
        {to ?? "-"}
      </span>
    </span>
  );
}

export function CopyId({
  id,
  onTrace,
}: {
  id: string;
  onTrace?: (id: string) => void;
}) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setDone(true);
      toast.success("Correlation id copied");
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };
  return (
    <span className="inline-flex items-center overflow-hidden rounded-md border border-border/60 bg-surface-2 font-mono text-xs">
      {onTrace ? (
        <button
          type="button"
          className="flex items-center gap-1 px-2 py-1 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onTrace(id)}
          aria-label={`Trace ${id}`}
        >
          <GitBranch className="h-3 w-3" aria-hidden="true" />
          {id.slice(0, 8)}…
        </button>
      ) : (
        <span className="px-2 py-1">{id}</span>
      )}
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${id}`}
        className="border-l border-border/60 px-1.5 py-1 text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {done ? (
          <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
        ) : (
          <Copy className="h-3 w-3" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

export function AuditTable({
  events,
  onTrace,
}: {
  events: AuditEvent[];
  onTrace: (correlationId: string) => void;
}) {
  return (
    <div className="[&_td]:px-3 [&_th]:px-3">
      <Table aria-label="Audit events">
        <THead>
          <TR>
            <TH>Time</TH>
            <TH>Actor</TH>
            <TH>Entity</TH>
            <TH>Action</TH>
            <TH>State change</TH>
            <TH>Correlation ID</TH>
          </TR>
        </THead>
        <TBody>
          {events.length === 0 && (
            <TableEmptyRow colSpan={6}>No audit events match</TableEmptyRow>
          )}
          {events.map((e) => (
            <TR key={e.id} className="h-14">
              <TD className="whitespace-nowrap font-mono text-xs">
                {formatTime(e.at)}
              </TD>
              <TD>
                <ActorCell actor={e.actor} />
              </TD>
              <TD>
                <EntityCell e={e} />
              </TD>
              <TD>
                <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground ring-1 ring-border">
                  {e.action}
                </span>
              </TD>
              <TD>
                <StateChange from={e.from_state} to={e.to_state} />
              </TD>
              <TD>
                <CopyId id={e.correlation_id} onTrace={onTrace} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
