import { Link, useParams } from 'react-router-dom';
import { Activity, ChevronRight, Clock, Mail, PackageSearch, ShieldCheck, Timer, Wallet } from 'lucide-react';
import { useSupplier } from '@/api/queries';
import { ApiError } from '@/api/client';
import type { SupplierDetail as SupplierDetailData } from '@/api/types';
import { GradientRing, StatCard } from '@/components/patterns';
import { Badge, Button, EmptyState, ErrorState, Money, SeverityBadge, Skeleton } from '@/components/ui';
import { DisruptionHistory } from '@/features/suppliers/detail/DisruptionHistory';
import { RiskGauge } from '@/features/suppliers/detail/RiskGauge';
import { SupplierMonogram } from '@/features/suppliers/list/parts';
import { flagFor } from '@/features/suppliers/list/risk';
import { SUPPLIER_STATUS } from '@/features/suppliers/status';

function Breadcrumb({ name }: { name?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex items-center gap-1">
        <li>
          <Link to="/suppliers" className="font-medium text-primary hover:underline">
            Suppliers
          </Link>
        </li>
        {name && (
          <>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="text-foreground">
              {name}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

function LoadingView() {
  return (
    <div aria-busy="true" data-testid="supplier-skeleton" className="space-y-6">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function Hero({ s }: { s: SupplierDetailData }) {
  const status = SUPPLIER_STATUS[s.status];
  return (
    <GradientRing>
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-[15px] bg-card p-6 duration-200 animate-in fade-in">
        <div className="flex min-w-0 items-center gap-5">
          <GradientRing radius="rounded-2xl">
            <SupplierMonogram name={s.name} level={s.risk_level} className="h-16 w-16 rounded-[15px] text-xl" />
          </GradientRing>
          <div className="min-w-0 space-y-2">
            <h1 className="truncate text-3xl font-semibold tracking-tight">{s.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="font-mono text-muted">{s.id}</span>
              <span aria-hidden="true">{flagFor(s.country)}</span>
              <span className="text-muted">
                {s.country} · {s.category}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status.tone}>{status.label}</Badge>
              <SeverityBadge severity={s.risk_level} />
              <a
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                href={`mailto:${s.contact_email}`}
              >
                <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                {s.contact_email}
              </a>
            </div>
          </div>
        </div>
        <RiskGauge score={s.risk_score} level={s.risk_level} />
      </div>
    </GradientRing>
  );
}

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const q = useSupplier(id);

  if (q.isPending) {
    return (
      <section className="space-y-6">
        <Breadcrumb />
        <LoadingView />
      </section>
    );
  }

  if (q.isError) {
    const err = q.error;
    if (err instanceof ApiError && err.status === 404) {
      return (
        <section className="space-y-6">
          <Breadcrumb />
          <EmptyState
            icon={<PackageSearch />}
            title="Supplier not found"
            description={`No supplier with ID ${id} exists.`}
            action={
              <Button asChild variant="secondary" size="sm">
                <Link to="/suppliers">Back to suppliers</Link>
              </Button>
            }
          />
        </section>
      );
    }
    return (
      <section className="space-y-6">
        <Breadcrumb />
        <ErrorState
          title="Could not load supplier"
          message={err.message}
          correlationId={err instanceof ApiError ? (err.correlationId ?? undefined) : undefined}
          onRetry={() => void q.refetch()}
        />
      </section>
    );
  }

  const s = q.data;
  const k = s.kpis;
  return (
    <section className="space-y-6">
      <Breadcrumb name={s.name} />
      <Hero s={s} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="On-time delivery" value={`${k.on_time_delivery_pct}%`} icon={<Clock />} tone="emerald" />
        <StatCard label="Quality pass" value={k.quality_pass_pct == null ? 'Not available' : `${k.quality_pass_pct}%`} icon={<ShieldCheck />} tone="primary" />
        <StatCard label="Avg lead time" value={k.avg_lead_time_days == null ? 'Not available' : `${k.avg_lead_time_days} days`} icon={<Timer />} tone="sky" />
        <StatCard label="Open PO value" value={<Money value={k.open_po_value} />} icon={<Wallet />} tone="violet" />
        <StatCard label="Disruptions (12 months)" value={k.disruptions_last_12m} icon={<Activity />} tone="amber" />
      </div>
      <DisruptionHistory items={s.disruption_history} />
    </section>
  );
}
