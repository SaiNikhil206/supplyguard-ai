import { apiFetch } from './client';
import type {
  DashboardSummary,
  Me,
  MeResponse,
  Paginated,
  RiskCaseDetail,
  RiskCaseFilters,
  RiskCaseListItem,
  SimulateResult,
  SimulateScenario,
  Supplier,
  SupplierDetail,
  SupplierFilters,
} from './types';

export function qs(params: object = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function getMe(): Promise<Me> {
  const r = await apiFetch<MeResponse>('/me');
  return {
    user: { id: r.id, full_name: r.name || r.email, email: r.email },
    tenant: r.tenant,
    role: r.role,
  };
}

export const listSuppliers = (filters: SupplierFilters = {}) =>
  apiFetch<Paginated<Supplier>>(`/suppliers${qs(filters)}`);

export const getSupplier = (id: string) =>
  apiFetch<SupplierDetail>(`/suppliers/${encodeURIComponent(id)}`);

export const getDashboardSummary = () => apiFetch<DashboardSummary>('/dashboard/summary');

export const listRiskCases = (filters: RiskCaseFilters = {}) =>
  apiFetch<Paginated<RiskCaseListItem>>(`/risk-cases${qs(filters)}`);

export const getRiskCase = (id: string) =>
  apiFetch<RiskCaseDetail>(`/risk-cases/${encodeURIComponent(id)}`);

export const simulateDisruption = (scenario: SimulateScenario | string) =>
  apiFetch<SimulateResult>('/demo/simulate-disruption', {
    method: 'POST',
    body: JSON.stringify(typeof scenario === 'string' ? { scenario } : scenario),
  });
