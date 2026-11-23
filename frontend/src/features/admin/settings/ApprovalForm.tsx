import { useState, type FormEvent } from 'react';
import { ApiError } from '@/api/client';
import type { TenantSettings } from '@/api/admin/settings';
import { Button, Field, Input } from '@/components/ui';
import { fieldErrors, useSaveSettings } from './hooks';

/** PROVISIONAL: approval settings and polling_seconds are not in docs/CONTRACTS.md yet. */
export function ApprovalForm({ settings }: { settings: TenantSettings }) {
  const initial = {
    comment: settings.approval.require_comment_on_reject,
    hours: String(settings.approval.auto_escalate_hours),
    polling: String(settings.polling_seconds),
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useSaveSettings();

  const dirty = form.comment !== initial.comment || form.hours !== initial.hours || form.polling !== initial.polling;

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    setErrors({});
    setFormError(null);
    setSaved(false);
    save.mutate(
      {
        approval: { require_comment_on_reject: form.comment, auto_escalate_hours: Number(form.hours) },
        polling_seconds: Number(form.polling),
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

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4" aria-label="Approval settings">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={form.comment}
          onChange={(e) => {
            setForm((f) => ({ ...f, comment: e.target.checked }));
            setSaved(false);
          }}
        />
        Require a comment when rejecting
      </label>
      <Field label="Auto-escalate after (hours)" error={errors['approval.auto_escalate_hours']}>
        <Input
          type="number"
          value={form.hours}
          onChange={(e) => {
            setForm((f) => ({ ...f, hours: e.target.value }));
            setSaved(false);
          }}
        />
      </Field>
      <Field label="Polling interval (seconds)" error={errors['polling_seconds']}>
        <Input
          type="number"
          value={form.polling}
          onChange={(e) => {
            setForm((f) => ({ ...f, polling: e.target.value }));
            setSaved(false);
          }}
        />
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
        Save approval settings
      </Button>
    </form>
  );
}
