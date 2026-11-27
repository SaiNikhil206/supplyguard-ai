import { http, HttpResponse, type HttpHandler } from 'msw';
import { USER_ROLES, type SettingsPatch, type TenantSettings, type TenantUser } from '@/api/admin/settings';
import { users as authUsers } from '../fixtures';

const initialSettings = (): TenantSettings => ({
  risk_thresholds: { medium: 30, high: 60, critical: 80, exposure_full_scale: 500000 },
  max_cost_increase_pct: 15,
  require_qualified_alternates: true,
});

const initialUsers = (): TenantUser[] => [
  ...authUsers.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.full_name,
    role: u.role as TenantUser['role'],
    is_active: true,
  })),
  { id: 'USR-4', username: 'ops', email: 'ops@acme.example', name: 'Olivia Ops', role: 'OPS_MANAGER', is_active: true },
];

let settings = initialSettings();
let tenantUsers = initialUsers();

/** Reset mutable mock state (tests). */
export function resetAdminSettingsMock() {
  settings = initialSettings();
  tenantUsers = initialUsers();
}

const API = '*/api/v1';

function err(status: number, code: string, message: string, request: Request, details: Record<string, unknown> = {}) {
  const cid = request.headers.get('X-Correlation-ID') ?? crypto.randomUUID();
  return HttpResponse.json(
    { error: { code, message, details, correlation_id: cid } },
    { status, headers: { 'X-Correlation-ID': cid } },
  );
}

/** Admin gate: returns an error Response, or null when the caller is an authenticated ADMIN. */
export function gate(request: Request): Response | null {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4))) as { exp: number; role: string };
    if (claims.exp <= Math.floor(Date.now() / 1000)) throw new Error('expired');
    if (claims.role !== 'ADMIN') return err(403, 'FORBIDDEN', 'Permission denied.', request);
    return null;
  } catch {
    return err(401, 'UNAUTHENTICATED', 'Authentication credentials were not provided or are invalid.', request);
  }
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Mirrors backend/apps/tenants/settings_schema.py error paths ({risk_thresholds: {high: [...]}}). */
function validate(patch: Record<string, unknown>, merged: TenantSettings): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    if (!['risk_thresholds', 'max_cost_increase_pct', 'require_qualified_alternates'].includes(k)) d[k] = ['Unknown setting.'];
  }
  const rt: Record<string, string[]> = {};
  const sent = (patch.risk_thresholds ?? {}) as Record<string, unknown>;
  for (const k of ['medium', 'high', 'critical'] as const) {
    if (k in sent && !(isNum(sent[k]) && sent[k] >= 0 && sent[k] <= 100)) rt[k] = ['Must be between 0 and 100.'];
  }
  if ('exposure_full_scale' in sent && !(isNum(sent.exposure_full_scale) && sent.exposure_full_scale > 0)) {
    rt.exposure_full_scale = ['Must be greater than 0 and at most 1e+12.'];
  }
  const t = merged.risk_thresholds;
  if (!Object.keys(rt).length) {
    if (!(t.medium < t.high)) rt.high = ['Thresholds must satisfy medium < high < critical.'];
    else if (!(t.high < t.critical)) rt.critical = ['Thresholds must satisfy medium < high < critical.'];
  }
  if (Object.keys(rt).length) d.risk_thresholds = rt;
  if (
    'max_cost_increase_pct' in patch &&
    !(isNum(patch.max_cost_increase_pct) && patch.max_cost_increase_pct >= 0 && patch.max_cost_increase_pct <= 1000)
  ) {
    d.max_cost_increase_pct = ['Must be a number between 0 and 1000.'];
  }
  if ('require_qualified_alternates' in patch && typeof patch.require_qualified_alternates !== 'boolean') {
    d.require_qualified_alternates = ['Must be true or false.'];
  }
  return d;
}

export const adminSettingsHandlers: HttpHandler[] = [
  http.get(`${API}/settings`, ({ request }) => gate(request) ?? HttpResponse.json(settings)),

  http.patch(`${API}/settings`, async ({ request }) => {
    const denied = gate(request);
    if (denied) return denied;
    const patch = (await request.json().catch(() => ({}))) as SettingsPatch & Record<string, unknown>;
    const next: TenantSettings = {
      ...settings,
      ...(patch as Partial<TenantSettings>),
      risk_thresholds: { ...settings.risk_thresholds, ...patch.risk_thresholds },
    };
    const details = validate(patch, next);
    if (Object.keys(details).length) return err(400, 'VALIDATION_ERROR', 'Validation failed.', request, details);
    settings = next;
    return HttpResponse.json(settings);
  }),

  http.get(`${API}/users`, ({ request }) =>
    gate(request) ?? HttpResponse.json({ count: tenantUsers.length, next: null, previous: null, results: tenantUsers }),
  ),

  http.post(`${API}/users`, async ({ request }) => {
    const denied = gate(request);
    if (denied) return denied;
    const b = (await request.json().catch(() => ({}))) as Record<string, string>;
    const details: Record<string, string[]> = {};
    for (const k of ['username', 'role', 'password']) {
      if (!b[k]?.trim()) details[k] = ['This field is required.'];
    }
    if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) details.email = ['Enter a valid email address.'];
    if (b.role && !(USER_ROLES as string[]).includes(b.role)) details.role = [`"${b.role}" is not a valid choice.`];
    if (b.password && b.password.length < 8) {
      details.password = ['This password is too short. It must contain at least 8 characters.'];
    }
    if (b.username && tenantUsers.some((u) => u.username.toLowerCase() === b.username.trim().toLowerCase())) {
      details.username = ['This username is not available.'];
    }
    if (Object.keys(details).length) return err(400, 'VALIDATION_ERROR', 'Validation failed.', request, details);
    const user: TenantUser = {
      id: `USR-${tenantUsers.length + 1}`,
      username: b.username.trim(),
      name: (b.name ?? '').trim(),
      email: (b.email ?? '').trim(),
      role: b.role as TenantUser['role'],
      is_active: true,
    };
    tenantUsers = [...tenantUsers, user];
    return HttpResponse.json(user, { status: 201 });
  }),
];
