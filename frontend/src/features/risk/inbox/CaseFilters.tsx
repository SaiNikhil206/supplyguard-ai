import { Select } from '@/components/ui';
import { STATUS_META } from '@/components/ui/StatusBadge';
import type { RiskCaseState } from '@/api/types';
import { STATES } from './filterOptions';

interface Props {
  status: RiskCaseState | undefined;
  onStatus: (s: RiskCaseState | undefined) => void;
}

export function CaseFilters({ status, onStatus }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="risk-status-filter" className="text-sm font-medium">
        Status
      </label>
      <Select
        id="risk-status-filter"
        value={status ?? ''}
        onChange={(e) => onStatus((e.target.value || undefined) as RiskCaseState | undefined)}
        className="w-52"
      >
        <option value="">All statuses</option>
        {STATES.map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </Select>
    </div>
  );
}
