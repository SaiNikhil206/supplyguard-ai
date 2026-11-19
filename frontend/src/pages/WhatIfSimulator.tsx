import { useState } from 'react';
import { ApiError } from '@/api/client';
import { useSuppliers } from '@/api/queries';
import { useWhatIf, type WhatIfRequest } from '@/api/whatif';
import { useAuth } from '@/auth/AuthProvider';
import { Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { WhatIfForm } from '@/features/whatif/WhatIfForm';
import { WhatIfResults } from '@/features/whatif/WhatIfResults';

const INITIAL: WhatIfRequest = { supplier_id: '', event_type: 'FACTORY_OUTAGE', duration_days: 7 };

export default function WhatIfSimulator() {
  const { hasRole } = useAuth();
  const canRun = hasRole('ADMIN', 'OPS_MANAGER', 'PROCUREMENT_MANAGER');
  const suppliers = useSuppliers({ page_size: 100 });
  const mutation = useWhatIf();
  const [values, setValues] = useState<WhatIfRequest>(INITIAL);
  const list = suppliers.data?.results ?? [];

  const run = (v: WhatIfRequest) => mutation.mutate(v);

  function preset() {
    const first = list[0];
    if (!first) return;
    const v: WhatIfRequest = { supplier_id: first.id, event_type: 'FACTORY_OUTAGE', duration_days: 7 };
    setValues(v);
    run(v);
  }

  const err = mutation.error;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">What-if Simulator</h1>
      <p className="text-sm text-muted">Estimate the impact of a supplier disruption. Nothing is saved or sent to the ERP.</p>
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Scenario</CardTitle>
          </CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>
        <div aria-live="polite">
          {mutation.isPending && (
            <div data-testid="whatif-skeleton" className="space-y-3" aria-busy="true">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          {!mutation.isPending && err && (
            <ErrorState
              title="Simulation failed"
              message={err.message}
              correlationId={err instanceof ApiError ? (err.correlationId ?? undefined) : undefined}
            />
          )}
          {!mutation.isPending && !err && mutation.data && <WhatIfResults result={mutation.data} />}
          {mutation.isIdle && (
            <EmptyState
              title="No simulation yet"
              description="Pick a supplier, event and duration, then run the simulation, or try the preset."
            />
          )}
        </div>
      </div>
    </section>
  );
}
