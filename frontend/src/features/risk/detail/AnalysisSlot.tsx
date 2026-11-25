import { Sparkles } from 'lucide-react';
import type { RiskAnalysis, RiskCaseState } from '@/api/types';
import { AnalysisPanel } from '@/features/risk/analysis';

export interface AnalysisSlotProps {
  caseId: string;
  status: RiskCaseState;
  analysis: RiskAnalysis | null;
}

export function AnalysisSlot({ status, analysis }: AnalysisSlotProps) {
  return (
    <div className="rounded-2xl bg-border p-px">
      <section aria-labelledby="analysis-heading" className="rounded-[15px] bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5 text-muted">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
          </span>
          <h2 id="analysis-heading" className="text-base font-semibold">
            AI risk analysis
          </h2>
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-500 ring-1 ring-violet-500/20">
            AI
          </span>
        </div>
        <div data-testid="analysis-slot">
          <AnalysisPanel analysis={analysis} status={status} />
        </div>
      </section>
    </div>
  );
}
