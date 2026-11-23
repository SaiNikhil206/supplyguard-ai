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
        <div className="self-start lg:sticky lg:top-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Scenario</h2>
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
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-72 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
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
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
              <FlaskConical
                className="h-10 w-10 text-muted"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold">No simulation yet</h2>
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
