import { Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Sticky bottom bar for settings forms. Always mounted so the submit button stays addressable;
 * it slides up and shows "Unsaved changes" only while the form is dirty. Render inside the <form>.
 */
export function SaveBar({
  dirty,
  saving,
  label,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  label: string;
  onDiscard: () => void;
}) {
  return (
    <div
      data-testid="save-bar"
      data-dirty={dirty}
      className={cn(
        "sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-lg backdrop-blur transition-all duration-200",
        dirty
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0 motion-reduce:transition-none",
      )}
    >
      <p className="flex items-center gap-2 text-sm font-medium" role="status">
        {dirty && (
          <>
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-amber-500"
            />
            Unsaved changes
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={saving}
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Discard
          </Button>
        )}
        <Button type="submit" disabled={!dirty} loading={saving}>
          {!saving && <Save className="h-4 w-4" aria-hidden="true" />}
          {label}
        </Button>
      </div>
    </div>
  );
}
