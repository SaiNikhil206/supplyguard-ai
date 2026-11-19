import { useId, useMemo, useState, type FormEvent } from 'react';
import type { EventType, Severity, Supplier } from '@/api/types';
import type { WhatIfRequest } from '@/api/whatif';
import { Button, Field, Input, Select } from '@/components/ui';
import { EVENT_LABELS, SEVERITIES } from './labels';

export interface WhatIfFormProps {
  suppliers: Supplier[];
  suppliersLoading: boolean;
  values: WhatIfRequest;
  onChange: (v: WhatIfRequest) => void;
  onSubmit: (v: WhatIfRequest) => void;
  onPreset: () => void;
  running: boolean;
  canRun: boolean;
}

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
  const [filter, setFilter] = useState('');
  const sliderId = useId();
  const noteId = useId();

  const options = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f ? suppliers.filter((s) => s.name.toLowerCase().includes(f) || s.id.toLowerCase().includes(f)) : suppliers;
    const sel = suppliers.find((s) => s.id === values.supplier_id);
    return sel && !list.includes(sel) ? [sel, ...list] : list;
  }, [suppliers, filter, values.supplier_id]);

  const set = (patch: Partial<WhatIfRequest>) => onChange({ ...values, ...patch });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (canRun && values.supplier_id) onSubmit(values);
  }

  const disabled = !canRun || running;
  const days = `${values.duration_days} ${values.duration_days === 1 ? 'day' : 'days'}`;

  return (
    <form onSubmit={submit} aria-label="What-if scenario" className="space-y-4">
      <Field label="Search suppliers" hint="Type to narrow the supplier list.">
        <Input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </Field>
      <Field label="Supplier">
        <Select value={values.supplier_id} onChange={(e) => set({ supplier_id: e.target.value })} disabled={suppliersLoading}>
          <option value="">{suppliersLoading ? 'Loading suppliers…' : 'Select a supplier'}</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.id})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Event type">
        <Select value={values.event_type} onChange={(e) => set({ event_type: e.target.value as EventType })}>
          {(Object.keys(EVENT_LABELS) as EventType[]).map((t) => (
            <option key={t} value={t}>
              {EVENT_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="space-y-1">
        <label htmlFor={sliderId} className="block text-sm font-medium text-text">
          Duration: <span className="tabular-nums">{days}</span>
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
          className="w-full accent-primary"
        />
      </div>
      <Field label="Severity (optional)" hint="Supplier default uses the supplier's current risk level.">
        <Select
          value={values.severity ?? ''}
          onChange={(e) => set({ severity: (e.target.value || undefined) as Severity | undefined })}
        >
          <option value="">Supplier default</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          loading={running}
          disabled={disabled || !values.supplier_id}
          aria-describedby={!canRun ? noteId : undefined}
        >
          Run simulation
        </Button>
        <Button variant="secondary" onClick={onPreset} disabled={disabled || suppliers.length === 0}>
          Supplier A out 7 days
        </Button>
      </div>
      {!canRun && (
        <p id={noteId} className="text-sm text-muted">
          Your role is read-only, so you can&apos;t run simulations. Ask an Ops or Procurement manager.
        </p>
      )}
    </form>
  );
}
