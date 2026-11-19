import { Spinner } from '@/components/ui';
import type { RiskAnalysis, RiskCaseState } from '@/api/types';

export interface AnalysisSlotProps {
  caseId: string;
  status: RiskCaseState;
  analysis: RiskAnalysis | null;
}

/** Isolated slot: swap its body for <AnalysisPanel> once that lands. */
export function AnalysisSlot({ status, analysis }: AnalysisSlotProps) {
  const inFlight = status === 'RECEIVED' || status === 'ANALYZING';
  return (
    <section aria-labelledby="analysis-heading" className="rounded-lg border border-border bg-surface p-4">
      <h2 id="analysis-heading" className="mb-3 text-base font-semibold text-text">
        AI risk analysis
      </h2>
      <div data-testid="analysis-slot">
        {analysis ? (
          <p className="text-sm text-text">{analysis.summary}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            {inFlight && <Spinner size="sm" label="Analysis in progress" />}
            Analysis pending
          </p>
        )}
      </div>
    </section>
  );
}
