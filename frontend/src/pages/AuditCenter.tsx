import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  FilterX,
  ScrollText,
  Search,
} from "lucide-react";
import {
  Button,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";
import { PageHeader } from "@/features/admin/ui/PageHeader";
import { AUDIT_ENTITY_TYPES, useAudit } from "@/api/admin/audit";
import { AuditTable } from "@/features/admin/audit/AuditTable";
import { TraceView } from "@/features/admin/audit/TraceView";
import { AUDIT_ACTIONS } from "@/features/admin/audit/stages";

const PAGE_SIZE = 10;

export default function AuditCenter() {
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? "";
  const correlationId = get("correlation_id");
  const trace = get("view") === "trace" && !!correlationId;
  const page = Math.max(1, Number(get("page")) || 1);

  const [search, setSearch] = useState(correlationId);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };

  const q = useAudit({
    entity_type: get("entity_type"),
    action: get("action"),
    from: get("from"),
    to: get("to"),
    correlation_id: correlationId,
    page,
    page_size: PAGE_SIZE,
  });

  const openTrace = (id: string) => {
    setSearch(id);
    update({ correlation_id: id, view: "trace" });
  };
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const id = search.trim();
    if (id) update({ correlation_id: id, view: "trace" });
    else update({ correlation_id: null, view: null });
  };

  const totalPages = q.data
    ? Math.max(1, Math.ceil(q.data.count / PAGE_SIZE))
    : 1;

  const hasFilters = ["entity_type", "action", "from", "to"].some((k) =>
    get(k),
  );
  const clear = () => {
    setSearch("");
    setParams(new URLSearchParams());
  };
  const panel =
    "rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur";

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit Center"
        description="Every event, decision and ERP change, traceable end to end by correlation id."
        actions={
          hasFilters || correlationId ? (
            <Button variant="secondary" size="sm" onClick={clear}>
              <FilterX className="h-4 w-4" aria-hidden="true" />
              Clear filters
            </Button>
          ) : undefined
        }
      />

      <div className={panel}>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Entity type">
            <Select
              value={get("entity_type")}
              onChange={(e) =>
                update({ entity_type: e.target.value, view: null })
              }
            >
              <option value="">All</option>
              {AUDIT_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Action">
            <Select
              value={get("action")}
              onChange={(e) => update({ action: e.target.value, view: null })}
            >
              <option value="">All</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input
              type="date"
              value={get("from")}
              onChange={(e) => update({ from: e.target.value })}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={get("to")}
              onChange={(e) => update({ to: e.target.value })}
            />
          </Field>
        </div>
        <form
          onSubmit={onSearch}
          className="flex flex-wrap items-end gap-3 border-t border-border/60 p-4"
        >
          <Field label="Correlation ID" className="min-w-72 flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Paste a correlation id"
              className="font-mono"
            />
          </Field>
          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </Button>
        </form>
      </div>

      {trace ? (
        <TraceView
          correlationId={correlationId}
          onBack={() => update({ view: null })}
        />
      ) : (
        <div className={panel}>
          {q.isLoading && (
            <div className="space-y-2 p-4" aria-busy="true">
              <span className="sr-only">Loading audit events</span>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          )}
          {q.isError && (
            <ErrorState
              message={q.error.message}
              onRetry={() => void q.refetch()}
            />
          )}
          {q.data && q.data.results.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ScrollText className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="text-lg font-semibold">No audit events match</p>
              <p className="text-sm text-muted">
                Try widening the date range or clearing a filter.
              </p>
            </div>
          )}
          {q.data && q.data.results.length > 0 && (
            <AuditTable events={q.data.results} onTrace={openTrace} />
          )}
          {q.data && q.data.count > PAGE_SIZE && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between border-t border-border/60 p-3 text-sm"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={!q.data.previous}
                onClick={() => update({ page: String(page - 1) })}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Button>
              <span className="tabular-nums text-muted">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!q.data.next}
                onClick={() => update({ page: String(page + 1) })}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
