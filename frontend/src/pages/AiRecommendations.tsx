import { useSearchParams } from 'react-router-dom';
import { CasePicker } from '@/features/recommendations/CasePicker';
import { CaseRecommendations } from '@/features/recommendations/CaseRecommendations';
import { PageHeader } from '@/features/risk/ui';

export default function AiRecommendations() {
  const [params] = useSearchParams();
  const caseId = params.get('case');
  return (
    <section className="space-y-6">
      <PageHeader
        title="AI Recommendations"
        description="Ranked recovery options with cost, lead time, trade-offs and the evidence behind them."
      />
      {caseId ? <CaseRecommendations caseId={caseId} /> : <CasePicker />}
    </section>
  );
}
