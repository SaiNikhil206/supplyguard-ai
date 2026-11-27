import { useState, type FormEvent } from "react";
import { MessageSquareWarning, Timer } from "lucide-react";
import { ApiError } from "@/api/client";
import type { TenantSettings } from "@/api/admin/settings";
import { Field, Input, toast } from "@/components/ui";
import { SaveBar } from "../ui/SaveBar";
import { Switch } from "../ui/Switch";
import { fieldErrors, useSaveSettings } from "./hooks";

/** Recovery policy: the two non-threshold tenant settings the backend supports. */
export function PolicyForm({ settings }: { settings: TenantSettings }) {
  const initial = {
    qualified: settings.require_qualified_alternates,
    pct: String(settings.max_cost_increase_pct),
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useSaveSettings();

  const dirty =
    form.qualified !== initial.qualified || form.pct !== initial.pct;
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
        require_qualified_alternates: form.qualified,
        max_cost_increase_pct: form.pct.trim() === "" ? NaN : Number(form.pct),
      },
      {
        onSuccess: () => {
          setSaved(true);
          toast.success("Policy updated");
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
      aria-label="Recovery policy"
    >
      <Switch
        checked={form.qualified}
        onChange={(v) => change({ qualified: v })}
        label="Require qualified alternate suppliers"
        description="Recommendations may only propose alternates that are already qualified."
        icon={<MessageSquareWarning aria-hidden="true" />}
      />
      <div className="grid gap-5 rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
        <Field
          label="Max cost increase (%)"
          error={errors["max_cost_increase_pct"]}
          hint="Recovery options costing more than this over the current order are flagged. 0 to 1000."
        >
          <Input
            type="number"
            value={form.pct}
            onChange={(e) => change({ pct: e.target.value })}
          />
        </Field>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Timer className="h-3.5 w-3.5" aria-hidden="true" /> Applies to new
          analyses only. Approval rules are fixed by role (see CONTRACTS).
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
        label="Save policy"
        onDiscard={() => {
          setForm(initial);
          setErrors({});
          setFormError(null);
        }}
      />
    </form>
  );
}
