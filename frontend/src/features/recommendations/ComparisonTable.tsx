import { EvidenceTag, Money } from '@/components/ui';
import type { Recommendation } from '@/api/types';
import { OPTION_TYPE_LABEL, bestIds, moneyNumber } from './format';

function Best() {
  return <strong className="ml-2 text-xs font-medium text-success">★ Best</strong>;
}

const NA = () => (
  <span>
    Not available <EvidenceTag kind="MISSING_DATA" />
  </span>
);

export function ComparisonTable({ recs }: { recs: Recommendation[] }) {
  const sameCurrency = new Set(recs.map((r) => r.estimated_cost_delta?.currency).filter(Boolean)).size <= 1;
  const bestLead = bestIds(recs, (r) => r.estimated_lead_time_days);
  const bestCost = sameCurrency ? bestIds(recs, (r) => moneyNumber(r.estimated_cost_delta)) : new Set<string>();
  const bestRank = bestIds(recs, (r) => r.rank);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" aria-label="Comparison of recovery options">
        <thead>
          <tr className="border-b border-border bg-surface-2/50 text-xs font-medium text-muted">
            <th scope="col" className="px-4 py-3">Option</th>
            <th scope="col" className="px-4 py-3">Rank</th>
            <th scope="col" className="px-4 py-3">Lead time</th>
            <th scope="col" className="px-4 py-3">Cost delta</th>
          </tr>
        </thead>
        <tbody>
          {recs.map((r) => (
            <tr key={r.id} className="h-12 border-b border-border last:border-0">
              <th scope="row" className="px-4 py-3 font-medium">{OPTION_TYPE_LABEL[r.option_type]}</th>
              <td className="px-4 py-3">
                {r.rank}
                {bestRank.has(r.id) && <Best />}
              </td>
              <td className="px-4 py-3">
                {r.estimated_lead_time_days === null ? (
                  <NA />
                ) : (
                  <>
                    {r.estimated_lead_time_days} days
                    {bestLead.has(r.id) && <Best />}
                  </>
                )}
              </td>
              <td className="px-4 py-3">
                {r.estimated_cost_delta === null ? (
                  <NA />
                ) : (
                  <>
                    <Money value={r.estimated_cost_delta} />
                    {bestCost.has(r.id) && <Best />}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
