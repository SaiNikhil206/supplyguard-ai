import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, SearchX, Search, X } from 'lucide-react';
import { listSuppliers } from '@/api/endpoints';
import { useClampPage } from '@/api/useClampPage';
import { queryKeys } from '@/api/queries';
import { ApiError } from '@/api/client';
import { PageHeader } from '@/components/patterns';
import { Button, Card, EmptyState, ErrorState, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { SupplierTable } from '@/features/suppliers/list/SupplierTable';
import { SummaryChips } from '@/features/suppliers/list/SummaryChips';
import { countByLevel } from '@/features/suppliers/list/risk';
import { RISK_OPTIONS, filtersFromParams } from '@/features/suppliers/list/params';
import { STATUS_OPTIONS } from '@/features/suppliers/status';

const DEBOUNCE_MS = 300;
const ALL_FILTERS = { page_size: 100 };

export default function SupplierIntelligence() {
  const [params, setParams] = useSearchParams();
  const parsed = filtersFromParams(params);
  const pageSize = parsed.page_size ?? 10;
  // Always send page_size: the backend default (25) differs from this page's 10.
  const filters = { ...parsed, page_size: pageSize };

  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Update params; any filter change resets to page 1 unless keepPage. */
  const update = (changes: Record<string, string | undefined>, keepPage = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!keepPage) next.delete('page');
        return next;
      },
      { replace: true },
    );

  const onSearch = (value: string) => {
    setSearchText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ search: value.trim() || undefined }), DEBOUNCE_MS);
  };

  const clear = () => {
    clearTimeout(timer.current);
    setSearchText('');
    update({ search: undefined, status: undefined, risk_level: undefined });
  };

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: queryKeys.suppliers(filters),
    queryFn: () => listSuppliers(filters),
    placeholderData: keepPreviousData,
  });

  // Unfiltered list feeds the risk summary chips.
  const all = useQuery({ queryKey: queryKeys.suppliers(ALL_FILTERS), queryFn: () => listSuppliers(ALL_FILTERS) });
  const counts = all.data ? countByLevel(all.data.results) : undefined;

  // ?page=N beyond the last page: the API answers 404; clamp to the last page (replace, no history).
  const clamping = useClampPage({
    error,
    page: filters.page,
    pageSize,
    fetchCount: async () => (await listSuppliers({ ...filters, page: 1 })).count,
    onClamp: (p) => update({ page: String(p) }, true),
  });

  const hasFilters = !!(filters.search || filters.status || filters.risk_level || searchText);
  const totalPages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;
  const from = data && data.count > 0 ? (filters.page - 1) * pageSize + 1 : 0;
  const to = data ? Math.min(data.count, filters.page * pageSize) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Suppliers"
        title="Supplier Intelligence"
        description="Risk, reliability and disruption exposure across your supplier base."
        actions={
          data && (
            <p className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary" aria-live="polite">
              {data.count} {data.count === 1 ? 'supplier' : 'suppliers'}
            </p>
          )
        }
      />

      <SummaryChips counts={counts} active={filters.risk_level} onSelect={(lvl) => update({ risk_level: lvl })} />

      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm backdrop-blur">
        <form
          role="search"
          aria-label="Supplier filters"
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4"
        >
          <div className="relative min-w-[14rem] flex-1">
            <label htmlFor="supplier-search" className="sr-only">
              Search
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              id="supplier-search"
              type="search"
              placeholder="Search by name or ID"
              className="pl-9"
              value={searchText}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>

          <div role="group" aria-label="Status" className="inline-flex rounded-xl bg-foreground/5 p-1">
            {[{ value: undefined, label: 'All' }, ...STATUS_OPTIONS].map((o) => {
              const on = filters.status === o.value;
              return (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ status: o.value })}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    on ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground',
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          <div className="w-40">
            <label htmlFor="supplier-risk" className="sr-only">
              Risk level
            </label>
            <Select
              id="supplier-risk"
              value={filters.risk_level ?? ''}
              onChange={(e) => update({ risk_level: e.target.value || undefined })}
            >
              <option value="">All risk levels</option>
              {RISK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <Button variant="ghost" onClick={clear} disabled={!hasFilters}>
            <X aria-hidden="true" className="mr-1 h-4 w-4" />
            Clear filters
          </Button>
        </form>

        {clamping ? (
          <SupplierTable loading />
        ) : isError ? (
          <ErrorState
            message={error instanceof ApiError ? error.message : 'Could not load suppliers.'}
            correlationId={error instanceof ApiError ? (error.correlationId ?? undefined) : undefined}
            onRetry={() => void refetch()}
          />
        ) : isPending ? (
          <SupplierTable loading />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="No suppliers match these filters"
            description="Try a different search or clear the filters."
            action={
              <Button variant="secondary" size="sm" onClick={clear}>
                Clear
              </Button>
            }
          />
        ) : (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <SupplierTable suppliers={data.results} />
          </div>
        )}

        {data && data.count > 0 && (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
            <span className="hidden text-xs text-muted sm:inline">
              Showing {from}–{to} of {data.count}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={!data.previous}
                onClick={() => update({ page: String(filters.page - 1) }, true)}
              >
                <ChevronLeft aria-hidden="true" className="mr-1 h-4 w-4" />
                Prev
              </Button>
              <span className="text-sm text-muted">
                Page {filters.page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!data.next}
                onClick={() => update({ page: String(filters.page + 1) }, true)}
              >
                Next
                <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </nav>
        )}
      </Card>
    </div>
  );
}
