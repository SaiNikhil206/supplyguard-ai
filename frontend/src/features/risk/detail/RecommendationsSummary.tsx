import { Link } from 'react-router-dom';
import type { RiskCaseDetail } from '@/api/types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui';

export function RecommendationsSummary({ detail }: { detail: RiskCaseDetail }) {
  const n = detail.recommendations.length;
  return (
    <Card className="overflow-hidden" role="region" aria-labelledby="recs-heading">
      <CardHeader>
        <CardTitle id="recs-heading">Recommendations</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2 text-sm">
        <p className="text-text">{n === 0 ? 'No recommendations yet' : `${n} recovery option${n === 1 ? '' : 's'} proposed`}</p>
        {detail.no_viable_option_reason && (
          <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-text">
            <span className="font-semibold">No viable option: </span>
            {detail.no_viable_option_reason}
          </p>
        )}
        <Link className="font-medium text-primary hover:underline" to={`/recommendations?case=${encodeURIComponent(detail.id)}`}>
          Review in AI Recommendations <span aria-hidden="true">→</span>
        </Link>
      </CardBody>
    </Card>
  );
}
