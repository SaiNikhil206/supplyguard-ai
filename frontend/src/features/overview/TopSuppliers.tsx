import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listSuppliers } from "@/api/endpoints";
import { queryKeys } from "@/api/queries";
import { SectionTitle } from "@/components/patterns";
import { SeverityBadge, Skeleton } from "@/components/ui";
import { RiskBar, SupplierMonogram } from "@/features/suppliers/list/parts";

const FILTERS = { page_size: 100 };

/** Mini list of the five highest-risk suppliers. */
export function TopSuppliers() {
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.suppliers(FILTERS),
    queryFn: () => listSuppliers(FILTERS),
  });
  const top = data
    ? [...data.results].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5)
    : [];
  return (
    <section
      aria-label="Top suppliers at risk"
      className="rounded-lg border border-border bg-card p-5"
    >
      <SectionTitle
        title="Top suppliers at risk"
        description="Ranked by risk score"
        action={
          <Link
            to="/suppliers"
            className="text-xs font-medium text-primary hover:underline"
          >
            All suppliers
          </Link>
        }
      />
      <div className="mt-4 space-y-1">
        {isPending ? (
          Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))
        ) : isError || top.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {isError ? "Could not load suppliers." : "No suppliers yet."}
          </p>
        ) : (
          top.map((s) => (
            <Link
              key={s.id}
              to={`/suppliers/${s.id}`}
              className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <SupplierMonogram name={s.name} level={s.risk_level} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {s.name}
              </span>
              <RiskBar
                score={s.risk_score}
                level={s.risk_level}
                className="w-20"
              />
              <SeverityBadge
                severity={s.risk_level}
                className="hidden sm:inline-flex"
              />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
