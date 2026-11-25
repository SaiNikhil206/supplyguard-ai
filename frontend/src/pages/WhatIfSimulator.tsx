import { useState } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { ApiError } from "@/api/client";
import { useSuppliers } from "@/api/queries";
import { useWhatIf, type WhatIfRequest } from "@/api/whatif";
import { useAuth } from "@/auth/AuthProvider";
import { Badge, ErrorState, Skeleton } from "@/components/ui";
import { WhatIfForm } from "@/features/whatif/WhatIfForm";
import { WhatIfResults } from "@/features/whatif/WhatIfResults";
import type { Preset } from "@/features/whatif/labels";
import { PageHeader } from "@/features/admin/ui/PageHeader";

const INITIAL: WhatIfRequest = {
  supplier_id: "",
  event_type: "FACTORY_OUTAGE",
  duration_days: 7,
};

function IdleIllustration() {
  return (
    <svg viewBox="0 0 160 120" className="h-28 w-36" aria-hidden="true">
      <defs>
        <linearGradient id="wi-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        x="8"
        y="10"
        width="144"
        height="100"
        rx="14"
        fill="hsl(var(--surface-2))"
        stroke="hsl(var(--border))"
      />
      <path
        d="M20 88 L50 62 L76 74 L104 40 L140 52 L140 100 L20 100 Z"
        fill="url(#wi-g)"
      />
      <path
        d="M20 88 L50 62 L76 74 L104 40 L140 52"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="104" cy="40" r="5" fill="hsl(var(--primary))" />
      <circle
        cx="104"
        cy="40"
        r="10"
        fill="hsl(var(--primary))"
        opacity="0.15"
      />
    </svg>
  );
}

export default function WhatIfSimulator() {
  const { hasRole } = useAuth();
  const canRun = hasRole("ADMIN", "OPS_MANAGER", "PROCUREMENT_MANAGER");
  const suppliers = useSuppliers({ page_size: 100 });
  const mutation = useWhatIf();
  const [values, setValues] = useState<WhatIfRequest>(INITIAL);
  const list = suppliers.data?.results ?? [];

  const run = (v: WhatIfRequest) => mutation.mutate(v);

  function preset(p: Preset) {
    const first = list[0];
    if (!first) return;
    const v: WhatIfRequest = {
      supplier_id: first.id,
      severity: undefined,
      ...p.patch,
    };
    setValues(v);
    run(v);
  }

  const err = mutation.error;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Scenario planning"
        title="What-if Simulator"
        description="Estimate the impact of a supplier disruption. Nothing is saved or sent to the ERP."
        actions={
          <Badge tone="success">
            <ShieldCheck aria-hidden="true" />
            Sandbox · no ERP writes
          </Badge>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        <div className="self-start rounded-2xl bg-gradient-to-br from-primary/40 via-border to-transparent p-px lg:sticky lg:top-4">
          <div className="rounded-2xl bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold tracking-tight">
              Scenario
            </h2>
            <WhatIfForm
              suppliers={list}
              suppliersLoading={suppliers.isLoading}
              values={values}
              onChange={setValues}
              onSubmit={run}
              onPreset={preset}
              running={mutation.isPending}
              canRun={canRun}
            />
          </div>
        </div>
        <div aria-live="polite">
          {mutation.isPending && (
            <div
              data-testid="whatif-skeleton"
              className="space-y-4"
              aria-busy="true"
            >
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-72 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          )}
          {!mutation.isPending && err && (
            <ErrorState
              title="Simulation failed"
              message={err.message}
              correlationId={
                err instanceof ApiError
                  ? (err.correlationId ?? undefined)
                  : undefined
              }
            />
          )}
          {!mutation.isPending && !err && mutation.data && (
            <WhatIfResults result={mutation.data} />
          )}
          {mutation.isIdle && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
              <IdleIllustration />
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold">No simulation yet</h2>
              <p className="max-w-sm text-sm text-muted">
                Pick a supplier, event and duration, then run the simulation, or
                start from a quick scenario.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
