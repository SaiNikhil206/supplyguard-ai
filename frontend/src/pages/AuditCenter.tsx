import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, ErrorState, Field, Input, Select, Spinner } from '@/components/ui';
import { AUDIT_ENTITY_TYPES, useAudit } from '@/api/admin/audit';
import { AuditTable } from '@/features/admin/audit/AuditTable';
import { TraceView } from '@/features/admin/audit/TraceView';
import { AUDIT_ACTIONS } from '@/features/admin/audit/stages';

const PAGE_SIZE = 10;

export default function AuditCenter() {
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? '';
  const correlationId = get('correlation_id');
  const trace = get('view') === 'trace' && !!correlationId;
  const page = Math.max(1, Number(get('page')) || 1);

  const [search, setSearch] = useState(correlationId);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const q = useAudit({
    entity_type: get('entity_type'),
    action: get('action'),
    from: get('from'),
    to: get('to'),
    correlation_id: correlationId,
    page,
    page_size: PAGE_SIZE,
  });

  const openTrace = (id: string) => {
    setSearch(id);
    update({ correlation_id: id, view: 'trace' });
  };
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const id = search.trim();
    if (id) update({ correlation_id: id, view: 'trace' });
    else update({ correlation_id: null, view: null });
  };

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.count / PAGE_SIZE)) : 1;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit Center</h1>

      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Entity type">
            <Select value={get('entity_type')} onChange={(e) => update({ entity_type: e.target.value, view: null })}>
              <option value="">All</option>
              {AUDIT_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Action">
            <Select value={get('action')} onChange={(e) => update({ action: e.target.value, view: null })}>
              <option value="">All</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" value={get('from')} onChange={(e) => update({ from: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="date" value={get('to')} onChange={(e) => update({ to: e.target.value })} />
          </Field>
        </div>
        <form onSubmit={onSearch} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
          <Field label="Correlation ID" className="min-w-72 flex-1">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Paste a correlation id" />
          </Field>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {trace ? (
        <TraceView correlationId={correlationId} onBack={() => update({ view: null })} />
      ) : (
        <Card>
          {q.isLoading && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}
          {q.isError && <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />}
          {q.data && <AuditTable events={q.data.results} onTrace={openTrace} />}
          {q.data && q.data.count > PAGE_SIZE && (
            <nav aria-label="Pagination" className="flex items-center justify-between border-t border-border p-3 text-sm">
              <Button
                variant="secondary"
                size="sm"
                disabled={!q.data.previous}
                onClick={() => update({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!q.data.next}
                onClick={() => update({ page: String(page + 1) })}
              >
                Next
              </Button>
            </nav>
          )}
        </Card>
      )}
    </section>
  );
}
