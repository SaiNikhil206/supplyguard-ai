import type { RiskAnalysis, RiskCaseState } from '@/api/types';
import { AiChip } from '@/components/ui';
import { AnalysisPanel } from '@/features/risk/analysis';

export interface AnalysisSlotProps {
  caseId: string;
  status: RiskCaseState;
  analysis: RiskAnalysis | null;
}

export function AnalysisSlot({ status, analysis }: AnalysisSlotProps) {
  return (
    <section aria-labelledby="analysis-heading" className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <h2 id="analysis-heading" className="text-sm font-semibold tracking-tight">
          AI risk analysis
        </h2>
        <AiChip />
      </div>
      <div data-testid="analysis-slot" className="p-5">
        <AnalysisPanel analysis={analysis} status={status} />
      </div>
    </section>
  );
}
