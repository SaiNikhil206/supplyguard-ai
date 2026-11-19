import { useSearchParams } from 'react-router-dom';
import { CasePicker } from '@/features/recommendations/CasePicker';
import { CaseRecommendations } from '@/features/recommendations/CaseRecommendations';

export default function AiRecommendations() {
  const [params] = useSearchParams();
  const caseId = params.get('case');
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">AI Recommendations</h1>
      {caseId ? <CaseRecommendations caseId={caseId} /> : <CasePicker />}
    </section>
  );
}
