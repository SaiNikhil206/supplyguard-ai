import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, CheckCircle2 } from 'lucide-react';
import { useRiskCases } from '@/api/queries';
import { SectionTitle } from '@/components/patterns';
import { Money, SeverityBadge, Skeleton } from '@/components/ui';
import { topOpenCases } from './format';

/** "Attention needed": top 3 open risk cases by severity. */
export function AttentionPanel() {
  const { data, isPending, isError } = useRiskCases({ page_size: 50 });
  const items = data ? topOpenCases(data.results) : [];
  return (
    <section
      aria-label="Attention needed"
      className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur"
    >
      <SectionTitle
        title="Attention needed"
        description="Highest-severity open risk cases"
        icon={<BellRing />}
        action={
          <Link to="/risk" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        }
      />
      <div className="mt-4 space-y-2">
        {isPending ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
        ) : isError ? (
          <p className="py-6 text-center text-sm text-muted">Could not load risk cases.</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs text-muted">No open risk cases need action.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/risk?case=${encodeURIComponent(c.id)}`}
                  className="group flex items-center gap-3 rounded-xl border border-border/60 p-3 transition hover:bg-muted/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={c.severity} />
                      <span className="truncate text-sm font-medium">{c.title}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {c.supplier_name} · {c.affected_po_count} POs · <Money value={c.exposure} />
                    </div>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
