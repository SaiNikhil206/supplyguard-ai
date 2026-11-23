import { useState, type FormEvent } from "react";
import { MessageSquareWarning, Timer } from "lucide-react";
import { ApiError } from "@/api/client";
import type { TenantSettings } from "@/api/admin/settings";
import { Field, Input, toast } from "@/components/ui";
import { SaveBar } from "../ui/SaveBar";
import { Switch } from "../ui/Switch";
import { fieldErrors, useSaveSettings } from "./hooks";

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

  const dirty =
    form.comment !== initial.comment ||
    form.hours !== initial.hours ||
    form.polling !== initial.polling;
  const change = (patch: Partial<typeof initial>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    setErrors({});
    setFormError(null);
    setSaved(false);
    save.mutate(
      {
        approval: {
          require_comment_on_reject: form.comment,
          auto_escalate_hours: Number(form.hours),
        },
        polling_seconds: Number(form.polling),
      },
      {
        onSuccess: () => {
          setSaved(true);
          toast.success("Approval settings updated");
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
            setErrors(fieldErrors(err.details));
            setFormError("Please fix the highlighted fields.");
          } else {
            setFormError(
              err instanceof Error ? err.message : "Could not save settings.",
            );
          }
          toast.error("Settings were not saved");
        },
      },
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="max-w-2xl space-y-5"
      aria-label="Approval settings"
    >
      <Switch
        checked={form.comment}
        onChange={(v) => change({ comment: v })}
        label="Require a comment when rejecting"
        description="Approvers must explain why a recommendation was rejected. The comment is stored in the audit trail."
        icon={<MessageSquareWarning aria-hidden="true" />}
      />
      <div className="grid gap-5 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
        <Field
          label="Auto-escalate after (hours)"
          error={errors["approval.auto_escalate_hours"]}
          hint="Pending approvals escalate to the next role."
        >
          <Input
            type="number"
            value={form.hours}
            onChange={(e) => change({ hours: e.target.value })}
          />
        </Field>
        <Field
          label="Polling interval (seconds)"
          error={errors["polling_seconds"]}
          hint="How often screens refresh live data."
        >
          <Input
            type="number"
            value={form.polling}
            onChange={(e) => change({ polling: e.target.value })}
          />
        </Field>
        <p className="flex items-center gap-1.5 text-xs text-muted sm:col-span-2">
          <Timer className="h-3.5 w-3.5" aria-hidden="true" /> Changes apply to
          new approvals and refreshes only.
        </p>
      </div>
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
      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        label="Save approval settings"
        onDiscard={() => {
          setForm(initial);
          setErrors({});
          setFormError(null);
        }}
      />
    </form>
  );
}
