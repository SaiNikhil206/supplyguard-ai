import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, Banknote, Boxes, Building2, ShieldCheck, Truck } from 'lucide-react';
import { useDashboardSummary } from '@/api/queries';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { ChartCard, PageHeader, StatCard } from '@/components/patterns';
import { Button, Card, EmptyState, ErrorState, Money } from '@/components/ui';
import { Skeleton } from '@/components/ui/Spinner';
import { AttentionPanel } from '@/features/overview/AttentionPanel';
import { TopSuppliers } from '@/features/overview/TopSuppliers';
import { CasesTrendChart, ExposureTrendChart } from '@/features/overview/TrendCharts';
import { derivedSeries, greeting, hasTrend, trendDelta } from '@/features/overview/format';

const KPI_LABELS = [
  'Suppliers',
  'Open POs',
  'Active shipments',
  'Exposure',
  'Open risk cases',
  'Recovered value',
] as const;

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3';

function LivePulse({ updatedAt }: { updatedAt: number }) {
  const time = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live · updated {time}
    </span>
  );
}

export default function ExecutiveOverview() {
  const { data, isPending, isError, error, refetch, dataUpdatedAt } = useDashboardSummary();
  const { me } = useAuth();
  const apiErr = error instanceof ApiError ? error : null;
  const empty = !!data && !hasTrend(data.exposure_trend) && !hasTrend(data.cases_trend);
  const firstName = me?.user.full_name?.split(' ')[0];

  const expDelta = data ? trendDelta(data.exposure_trend) : undefined;
  const caseDelta = data ? trendDelta(data.cases_trend) : undefined;
  const caseSeries = data?.cases_trend;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={me?.tenant.name ?? 'Overview'}
        title="Executive Overview"
        description={`${greeting()}${firstName ? `, ${firstName}` : ''}. Supply-chain exposure, open risk cases and recovery at a glance.`}
        meta={<LivePulse updatedAt={dataUpdatedAt} />}
        actions={
          <Button asChild>
            <Link to="/risk">
              Open Risk Command Center
              <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {isError ? (
        <Card>
          <ErrorState
            title="Could not load the overview"
            message={error instanceof Error ? error.message : 'Unexpected error.'}
            correlationId={apiErr?.correlationId ?? undefined}
            onRetry={() => void refetch()}
          />
        </Card>
      ) : (
        <>
          <section aria-label="Key metrics" className={GRID}>
            {isPending || !data ? (
              KPI_LABELS.map((l) => <StatCard key={l} label={l} value={null} loading />)
            ) : (
              <>
                <StatCard
                  label="Suppliers"
                  value={data.suppliers}
                  icon={<Building2 />}
                  tone="primary"
                  trend={derivedSeries(caseSeries, data.suppliers)}
                />
                <StatCard
                  label="Open POs"
                  value={data.open_pos}
                  icon={<Boxes />}
                  tone="sky"
                  trend={derivedSeries(caseSeries, data.open_pos)}
                />
                <StatCard
                  label="Active shipments"
                  value={data.active_shipments}
                  icon={<Truck />}
                  tone="violet"
                  trend={derivedSeries(caseSeries, data.active_shipments)}
                />
                <StatCard
                  label="Exposure"
                  value={<Money value={data.exposure} />}
                  icon={<AlertTriangle />}
                  tone="rose"
                  trend={data.exposure_trend.map((p) => p.value)}
                  delta={
                    expDelta
                      ? { value: `${expDelta.pct}%`, direction: expDelta.up ? 'up' : 'down', tone: expDelta.up ? 'bad' : 'good' }
                      : undefined
                  }
                  hint={expDelta ? 'vs. period start' : undefined}
                />
                <StatCard
                  label="Open risk cases"
                  value={
                    <Link to="/risk" className="text-primary hover:underline">
                      {data.open_cases}
                    </Link>
                  }
                  icon={<Activity />}
                  tone="amber"
                  trend={data.cases_trend.map((p) => p.value)}
                  delta={
                    caseDelta
                      ? { value: `${caseDelta.pct}%`, direction: caseDelta.up ? 'up' : 'down', tone: caseDelta.up ? 'bad' : 'good' }
                      : undefined
                  }
                  hint={caseDelta ? 'vs. period start' : 'View risk cases'}
                />
                <StatCard
                  label="Recovered value"
                  value={<Money value={data.recovered_value} />}
                  icon={<ShieldCheck />}
                  tone="emerald"
                  trend={derivedSeries(caseSeries, Number(data.recovered_value.amount))}
                />
              </>
            )}
          </section>

          <section aria-label="Trends" className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <ChartCard
              title="Exposure trend"
              description="Value of purchase orders exposed to open disruptions"
              className="lg:col-span-3"
              legend={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  <Banknote aria-hidden="true" className="h-3 w-3" /> Exposure
                </span>
              }
            >
              {isPending || !data ? (
                <div data-testid="chart-skeleton">
                  <Skeleton className="h-72 w-full rounded-xl" />
                </div>
              ) : empty || !hasTrend(data.exposure_trend) ? (
                <EmptyState title="No trend data yet" description="Exposure history will appear once disruptions are tracked." />
              ) : (
                <ExposureTrendChart data={data.exposure_trend} />
              )}
            </ChartCard>
            <ChartCard
              title="Risk cases trend"
              description="Open cases over time"
              className="lg:col-span-2"
              legend={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Activity aria-hidden="true" className="h-3 w-3" /> Cases
                </span>
              }
            >
              {isPending || !data ? (
                <div data-testid="chart-skeleton">
                  <Skeleton className="h-72 w-full rounded-xl" />
                </div>
              ) : empty || !hasTrend(data.cases_trend) ? (
                <EmptyState title="No trend data yet" description="Case history will appear once risk cases are opened." />
              ) : (
                <CasesTrendChart data={data.cases_trend} />
              )}
            </ChartCard>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AttentionPanel />
            <TopSuppliers />
          </div>
        </>
      )}
    </div>
  );
}
