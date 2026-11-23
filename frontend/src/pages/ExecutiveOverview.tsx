import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useDashboardSummary } from "@/api/queries";
import { ApiError } from "@/api/client";
import { ChartCard, PageHeader, StatCard } from "@/components/patterns";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Money,
} from "@/components/ui";
import { Skeleton } from "@/components/ui/Spinner";
import { AttentionPanel } from "@/features/overview/AttentionPanel";
import { TopSuppliers } from "@/features/overview/TopSuppliers";
import {
  CasesTrendChart,
  ExposureTrendChart,
} from "@/features/overview/TrendCharts";
import { hasTrend, trendDelta } from "@/features/overview/format";

const KPI_LABELS = [
  "Suppliers",
  "Open POs",
  "Active shipments",
  "Exposure",
  "Open risk cases",
  "Recovered value",
] as const;

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";

function LivePulse({ updatedAt }: { updatedAt: number }) {
  const time = updatedAt
    ? new Date(updatedAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  return (
    <Badge tone="success" dot>
      Live · updated {time}
    </Badge>
  );
}

export default function ExecutiveOverview() {
  const { data, isPending, isError, error, refetch, dataUpdatedAt } =
    useDashboardSummary();
  const apiErr = error instanceof ApiError ? error : null;
  const empty =
    !!data && !hasTrend(data.exposure_trend) && !hasTrend(data.cases_trend);

  const expDelta = data ? trendDelta(data.exposure_trend) : undefined;
  const caseDelta = data ? trendDelta(data.cases_trend) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Overview"
        description="Supply-chain exposure, open risk cases and recovery at a glance."
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
            message={
              error instanceof Error ? error.message : "Unexpected error."
            }
            correlationId={apiErr?.correlationId ?? undefined}
            onRetry={() => void refetch()}
          />
        </Card>
      ) : (
        <>
          <section aria-label="Key metrics" className={GRID}>
            {isPending || !data ? (
              KPI_LABELS.map((l) => (
                <StatCard key={l} label={l} value={null} loading />
              ))
            ) : (
              <>
                <StatCard label="Suppliers" value={data.suppliers} />
                <StatCard label="Open POs" value={data.open_pos} />
                <StatCard
                  label="Active shipments"
                  value={data.active_shipments}
                />
                <StatCard
                  label="Exposure"
                  value={<Money value={data.exposure} />}
                  delta={
                    expDelta
                      ? {
                          value: `${expDelta.pct}%`,
                          direction: expDelta.up ? "up" : "down",
                          tone: expDelta.up ? "bad" : "good",
                        }
                      : undefined
                  }
                  hint={expDelta ? "vs. period start" : undefined}
                />
                <StatCard
                  label="Open risk cases"
                  value={
                    <Link to="/risk" className="text-primary hover:underline">
                      {data.open_cases}
                    </Link>
                  }
                  delta={
                    caseDelta
                      ? {
                          value: `${caseDelta.pct}%`,
                          direction: caseDelta.up ? "up" : "down",
                          tone: caseDelta.up ? "bad" : "good",
                        }
                      : undefined
                  }
                  hint={caseDelta ? "vs. period start" : "View risk cases"}
                />
                <StatCard
                  label="Recovered value"
                  value={<Money value={data.recovered_value} />}
                />
              </>
            )}
          </section>

          <section
            aria-label="Trends"
            className="grid grid-cols-1 gap-4 lg:grid-cols-5"
          >
            <ChartCard
              title="Exposure trend"
              description="Value of purchase orders exposed to open disruptions"
              className="lg:col-span-3"
            >
              {isPending || !data ? (
                <div data-testid="chart-skeleton">
                  <Skeleton className="h-72 w-full rounded-md" />
                </div>
              ) : empty || !hasTrend(data.exposure_trend) ? (
                <EmptyState
                  title="No trend data yet"
                  description="Exposure history will appear once disruptions are tracked."
                />
              ) : (
                <ExposureTrendChart data={data.exposure_trend} />
              )}
            </ChartCard>
            <ChartCard
              title="Risk cases trend"
              description="Open cases over time"
              className="lg:col-span-2"
            >
              {isPending || !data ? (
                <div data-testid="chart-skeleton">
                  <Skeleton className="h-72 w-full rounded-md" />
                </div>
              ) : empty || !hasTrend(data.cases_trend) ? (
                <EmptyState
                  title="No trend data yet"
                  description="Case history will appear once risk cases are opened."
                />
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
