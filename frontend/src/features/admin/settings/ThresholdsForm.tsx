import { useState, type FormEvent } from 'react';
import { ApiError } from '@/api/client';
import type { TenantSettings } from '@/api/admin/settings';
import { Button, Field, Input } from '@/components/ui';
import { fieldErrors, useSaveSettings } from './hooks';

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

export function ThresholdsForm({ settings }: { settings: TenantSettings }) {
  const t = settings.risk_thresholds;
  const initial = {
    critical: String(t.critical_score),
    high: String(t.high_score),
    medium: String(t.medium_score),
    exposure: t.exposure_alert.amount,
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useSaveSettings();

  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((k) => form[k] !== initial[k]);
  const set = (k: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSaved(false);
    save.mutate(
      {
        risk_thresholds: {
          critical_score: num(form.critical),
          high_score: num(form.high),
          medium_score: num(form.medium),
          exposure_alert: { amount: form.exposure, currency: t.exposure_alert.currency },
        },
      },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
            setErrors(fieldErrors(err.details));
            setFormError('Please fix the highlighted fields.');
          } else {
            setFormError(err instanceof Error ? err.message : 'Could not save settings.');
          }
        },
      },
    );
  };

  const e = (k: string) => errors[`risk_thresholds.${k}`];

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4" aria-label="Risk thresholds">
      <Field label="Critical score (above)" error={e('critical_score')} hint="Scores 0-100; must exceed High.">
        <Input type="number" value={form.critical} onChange={set('critical')} />
      </Field>
      <Field label="High score (above)" error={e('high_score')} hint="Must exceed Medium.">
        <Input type="number" value={form.high} onChange={set('high')} />
      </Field>
      <Field label="Medium score (above)" error={e('medium_score')}>
        <Input type="number" value={form.medium} onChange={set('medium')} />
      </Field>
      <Field label={`Exposure alert (${t.exposure_alert.currency})`} error={e('exposure_alert')}>
        <Input type="number" value={form.exposure} onChange={set('exposure')} />
      </Field>
      {formError && (
        <p role="alert" className="text-sm font-medium text-danger">
          {formError}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-medium text-success">
          Settings saved.
        </p>
      )}
      <Button type="submit" disabled={!dirty} loading={save.isPending}>
        Save thresholds
      </Button>
    </form>
  );
}
