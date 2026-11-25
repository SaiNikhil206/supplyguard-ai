import { useId, useMemo, useState, type FormEvent } from "react";
import {
  Factory,
  Gauge,
  Lock,
  PackageX,
  Play,
  Ship,
  Sparkles,
  Truck,
} from "lucide-react";
import type { EventType, Severity, Supplier } from "@/api/types";
import type { WhatIfRequest } from "@/api/whatif";
import { Button, Field, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  EVENT_LABELS,
  PRESETS,
  SEVERITIES,
  SEVERITY_STYLE,
  type Preset,
} from "./labels";

const EVENT_ICONS: Record<EventType, typeof Factory> = {
  FACTORY_OUTAGE: Factory,
  SHIPMENT_DELAY: Ship,
  QUALITY_HOLD: PackageX,
  CAPACITY_REDUCTION: Gauge,
  LOGISTICS_DISRUPTION: Truck,
};

export interface WhatIfFormProps {
  suppliers: Supplier[];
  suppliersLoading: boolean;
  values: WhatIfRequest;
  onChange: (v: WhatIfRequest) => void;
  onSubmit: (v: WhatIfRequest) => void;
  onPreset: (p: Preset) => void;
  running: boolean;
  canRun: boolean;
}

const TICKS = [1, 7, 14, 21, 30];

export function WhatIfForm({
  suppliers,
  suppliersLoading,
  values,
  onChange,
  onSubmit,
  onPreset,
  running,
  canRun,
}: WhatIfFormProps) {
  const [filter, setFilter] = useState("");
  const sliderId = useId();
  const noteId = useId();

  const options = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f
      ? suppliers.filter(
          (s) =>
            s.name.toLowerCase().includes(f) || s.id.toLowerCase().includes(f),
        )
      : suppliers;
    const sel = suppliers.find((s) => s.id === values.supplier_id);
    return sel && !list.includes(sel) ? [sel, ...list] : list;
  }, [suppliers, filter, values.supplier_id]);

  const set = (patch: Partial<WhatIfRequest>) =>
    onChange({ ...values, ...patch });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (canRun && values.supplier_id) onSubmit(values);
  }

  const disabled = !canRun || running;
  const days = `${values.duration_days} ${values.duration_days === 1 ? "day" : "days"}`;
  const pct = ((values.duration_days - 1) / 29) * 100;

  return (
    <form onSubmit={submit} aria-label="What-if scenario" className="space-y-6">
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          <Sparkles
            className="h-3.5 w-3.5 text-violet-500"
            aria-hidden="true"
          />{" "}
          Quick scenarios
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant="secondary"
              className="rounded-full"
              onClick={() => onPreset(p)}
              disabled={disabled || suppliers.length === 0}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Field
          label="Search suppliers"
          hint="Type to narrow the supplier list."
        >
          <Input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </Field>
        <Field label="Supplier">
          <Select
            value={values.supplier_id}
            onChange={(e) => set({ supplier_id: e.target.value })}
            disabled={suppliersLoading}
          >
            <option value="">
              {suppliersLoading ? "Loading suppliers…" : "Select a supplier"}
            </option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div role="radiogroup" aria-label="Event type" className="space-y-2">
        <p className="text-sm font-medium">Event type</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(EVENT_LABELS) as EventType[]).map((t) => {
            const Icon = EVENT_ICONS[t];
            const on = values.event_type === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ event_type: t })}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/60 bg-card text-muted hover:border-primary/40 hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {EVENT_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor={sliderId}
          className="flex items-center justify-between text-sm font-medium"
        >
          <span>Duration</span>
          <span
            className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground"
            data-testid="duration-bubble"
          >
            {days}
          </span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={1}
          max={30}
          step={1}
          value={values.duration_days}
          onChange={(e) => set({ duration_days: Number(e.target.value) })}
          aria-valuetext={days}
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--border)) ${pct}%)`,
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-full accent-primary"
        />
        <div
          aria-hidden="true"
          className="flex justify-between text-[11px] tabular-nums text-muted"
        >
          {TICKS.map((t) => (
            <span key={t}>{t}d</span>
          ))}
        </div>
      </div>

      <div role="radiogroup" aria-label="Severity" className="space-y-2">
        <p className="text-sm font-medium">
          Severity <span className="font-normal text-muted">(optional)</span>
        </p>
        <div className="grid grid-cols-5 gap-1 rounded-xl bg-surface-2 p-1">
          {([undefined, ...SEVERITIES] as (Severity | undefined)[]).map((s) => {
            const on = values.severity === s;
            return (
              <button
                key={s ?? "default"}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ severity: s })}
                className={cn(
                  "rounded-lg px-1 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? s
                      ? cn("shadow-sm ring-1", SEVERITY_STYLE[s])
                      : "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground",
                )}
              >
                {s ? s.charAt(0) + s.slice(1).toLowerCase() : "Default"}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          Default uses the supplier&apos;s current risk level.
        </p>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={running}
        disabled={disabled || !values.supplier_id}
        aria-describedby={!canRun ? noteId : undefined}
      >
        {!running && <Play className="h-4 w-4" aria-hidden="true" />}
        Run simulation
      </Button>
      {!canRun && (
        <p
          id={noteId}
          className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-muted"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Your role is read-only, so you can&apos;t run simulations. Ask an Ops
          or Procurement manager.
        </p>
      )}
    </form>
  );
}
