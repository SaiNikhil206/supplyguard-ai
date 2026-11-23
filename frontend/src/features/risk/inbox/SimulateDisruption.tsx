import { useState } from 'react';
import { Check, Zap } from 'lucide-react';
import { useSimulateDisruption } from '@/api/queries';
import { ApiError } from '@/api/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  SeverityBadge,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { SCENARIOS } from '@/mocks/scenarios';
import { EVENT_ICON, SEV_META } from '../ui';

/** Admin-only trigger: pick a scenario card in a dialog, POST it, show pending / error / event id. */
export function SimulateDisruption() {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState(SCENARIOS[0].name);
  const [note, setNote] = useState<string | null>(null);
  const mutation = useSimulateDisruption();

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setNote(null);
      mutation.reset();
    }
  };

  const run = () => {
    setNote(null);
    mutation.mutate(scenario, {
      onSuccess: (res) => {
        setOpen(false);
        setNote(`Disruption event ${res.event_id} accepted. The new case appears below in a moment.`);
      },
    });
  };

  const error =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'Could not start the simulation. Try again.'
        : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button className="bg-gradient-to-r from-primary to-violet-600 text-white shadow-md transition hover:opacity-90 hover:shadow-lg">
            <Zap aria-hidden="true" className="h-4 w-4" />
            Simulate Supplier Disruption
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Simulate a supplier disruption</DialogTitle>
            <DialogDescription>Pick a scenario. SupplyGuard detects it, analyses impact and recommends recovery.</DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Choose a scenario</legend>
            {SCENARIOS.map((s) => {
              const Icon = EVENT_ICON[s.event_type];
              const selected = scenario === s.name;
              const m = SEV_META[s.severity];
              return (
                <label
                  key={s.name}
                  className={cn(
                    'relative flex cursor-pointer gap-3 rounded-xl border p-4 transition hover:shadow-md',
                    'focus-within:ring-2 focus-within:ring-ring',
                    selected ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-border/70 bg-card',
                  )}
                >
                  <input
                    type="radio"
                    name="scenario"
                    value={s.name}
                    checked={selected}
                    onChange={() => setScenario(s.name)}
                    className="sr-only"
                  />
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', m.tint, m.text)}>
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="block text-sm font-semibold">{s.label}</span>
                    <span className="block text-xs text-muted">{s.description}</span>
                    <SeverityBadge severity={s.severity} />
                  </span>
                  {selected && <Check aria-hidden="true" className="absolute right-3 top-3 h-4 w-4 text-primary" />}
                </label>
              );
            })}
          </fieldset>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={run} loading={mutation.isPending}>
              {mutation.isPending ? 'Starting...' : 'Run simulation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {note && (
        <p role="status" className="text-xs text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
