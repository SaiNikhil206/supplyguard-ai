import { useState, type FormEvent } from "react";
import { ApiError } from "@/api/client";
import type { TenantSettings } from "@/api/admin/settings";
import { Field, Input, toast } from "@/components/ui";
import { SaveBar } from "../ui/SaveBar";
import { RiskBands } from "./RiskBands";
import { fieldErrors, useSaveSettings } from "./hooks";

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

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

  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (k) => form[k] !== initial[k],
  );
  const set =
    (k: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
          exposure_alert: {
            amount: form.exposure,
            currency: t.exposure_alert.currency,
          },
        },
      },
      {
        onSuccess: () => {
          setSaved(true);
          toast.success("Thresholds updated");
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
        },
      },
    );
  };

  const e = (k: string) => errors[`risk_thresholds.${k}`];
  const slider = (k: "critical" | "high" | "medium", aria: string) => (
    <input
      type="range"
      min={0}
      max={100}
      step={1}
      value={Number.isFinite(num(form[k])) ? num(form[k]) : 0}
      aria-label={aria}
      onChange={set(k)}
      className="h-2 w-full cursor-pointer accent-primary"
    />
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Risk thresholds"
      className="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5 rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">Score thresholds</h2>
            <p className="text-sm text-muted">
              A case scoring above a threshold moves into that band.
            </p>
          </div>
          <div className="space-y-2">
            <Field
              label="Critical score (above)"
              error={e("critical_score")}
              hint="Scores 0-100; must exceed High."
            >
              <Input
                type="number"
                value={form.critical}
                onChange={set("critical")}
              />
            </Field>
            {slider("critical", "Adjust critical threshold")}
          </div>
          <div className="space-y-2">
            <Field
              label="High score (above)"
              error={e("high_score")}
              hint="Must exceed Medium."
            >
              <Input type="number" value={form.high} onChange={set("high")} />
            </Field>
            {slider("high", "Adjust high threshold")}
          </div>
          <div className="space-y-2">
            <Field label="Medium score (above)" error={e("medium_score")}>
              <Input
                type="number"
                value={form.medium}
                onChange={set("medium")}
              />
            </Field>
            {slider("medium", "Adjust medium threshold")}
          </div>
          <Field
            label={`Exposure alert (${t.exposure_alert.currency})`}
            error={e("exposure_alert")}
          >
            <Input
              type="number"
              value={form.exposure}
              onChange={set("exposure")}
            />
          </Field>
        </div>
        <div className="self-start rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
          <RiskBands
            medium={num(form.medium)}
            high={num(form.high)}
            critical={num(form.critical)}
          />
        </div>
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
        label="Save thresholds"
        onDiscard={() => {
          setForm(initial);
          setErrors({});
          setFormError(null);
          setSaved(false);
        }}
      />
    </form>
  );
}
