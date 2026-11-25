import { http, HttpResponse, type HttpHandler } from 'msw';
import { USER_ROLES, type TenantSettings, type TenantUser } from '@/api/admin/settings';
import { users as authUsers } from '../fixtures';

const initialSettings = (): TenantSettings => ({
  risk_thresholds: {
    critical_score: 80,
    high_score: 60,
    medium_score: 30,
    exposure_alert: { amount: '5000000.00', currency: 'INR' },
  },
  approval: { require_comment_on_reject: true, auto_escalate_hours: 24 },
  polling_seconds: 30,
});

const initialUsers = (): TenantUser[] => [
  ...authUsers.map((u) => ({
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    active: true,
  })),
  { id: 'USR-4', username: 'ops', full_name: 'Olivia Ops', email: 'ops@acme.example', role: 'OPS_MANAGER', active: true },
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
function gate(request: Request): Response | null {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4))) as { exp: number; role: string };
    if (claims.exp <= Math.floor(Date.now() / 1000)) throw new Error('expired');
    if (claims.role !== 'ADMIN') return err(403, 'FORBIDDEN', 'Admin role required.', request);
    return null;
  } catch {
    return err(401, 'UNAUTHENTICATED', 'Authentication credentials were not provided or are invalid.', request);
  }
}

const inRange = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;

function validateSettings(next: TenantSettings): Record<string, string[]> {
  const d: Record<string, string[]> = {};
  const t = next.risk_thresholds;
  const add = (k: string, m: string) => {
    d[k] = [...(d[k] ?? []), m];
  };
  for (const k of ['critical_score', 'high_score', 'medium_score'] as const) {
    if (!inRange(t[k])) add(`risk_thresholds.${k}`, 'Must be a number between 0 and 100.');
  }
  if (!d['risk_thresholds.high_score'] && !d['risk_thresholds.critical_score'] && t.critical_score <= t.high_score) {
    add('risk_thresholds.critical_score', 'Must be greater than the high threshold.');
  }
  if (!d['risk_thresholds.medium_score'] && !d['risk_thresholds.high_score'] && t.high_score <= t.medium_score) {
    add('risk_thresholds.high_score', 'Must be greater than the medium threshold.');
  }
  if (!(Number(t.exposure_alert?.amount) >= 0)) add('risk_thresholds.exposure_alert', 'Must be a non-negative amount.');
  if (!(next.approval.auto_escalate_hours >= 1)) add('approval.auto_escalate_hours', 'Must be at least 1 hour.');
  if (!(next.polling_seconds >= 5)) add('polling_seconds', 'Must be at least 5 seconds.');
  return d;
}

export const adminSettingsHandlers: HttpHandler[] = [
  http.get(`${API}/settings`, ({ request }) => gate(request) ?? HttpResponse.json(settings)),

  http.patch(`${API}/settings`, async ({ request }) => {
    const denied = gate(request);
    if (denied) return denied;
    const patch = (await request.json().catch(() => ({}))) as Partial<TenantSettings>;
    const next: TenantSettings = {
      risk_thresholds: { ...settings.risk_thresholds, ...patch.risk_thresholds },
      approval: { ...settings.approval, ...patch.approval },
      polling_seconds: patch.polling_seconds ?? settings.polling_seconds,
    };
    const details = validateSettings(next);
    if (Object.keys(details).length) {
      return err(400, 'VALIDATION_ERROR', 'Invalid settings.', request, details);
    }
    settings = next;
    return HttpResponse.json(settings);
  }),

  http.get(`${API}/users`, ({ request }) => gate(request) ?? HttpResponse.json(tenantUsers)),

  http.post(`${API}/users`, async ({ request }) => {
    const denied = gate(request);
    if (denied) return denied;
    const b = (await request.json().catch(() => ({}))) as Record<string, string>;
    const details: Record<string, string[]> = {};
    for (const k of ['username', 'full_name', 'email', 'role']) {
      if (!b[k]?.trim()) details[k] = ['This field is required.'];
    }
    if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) details.email = ['Enter a valid email address.'];
    if (b.role && !(USER_ROLES as string[]).includes(b.role)) details.role = ['Invalid role.'];
    if (Object.keys(details).length) return err(400, 'VALIDATION_ERROR', 'Invalid user.', request, details);
    if (tenantUsers.some((u) => u.username.toLowerCase() === b.username.trim().toLowerCase())) {
      return err(409, 'CONFLICT', `Username "${b.username}" already exists.`, request, {
        username: ['A user with this username already exists.'],
      });
    }
    const user: TenantUser = {
      id: `USR-${tenantUsers.length + 1}`,
      username: b.username.trim(),
      full_name: b.full_name.trim(),
      email: b.email.trim(),
      role: b.role as TenantUser['role'],
      active: true,
    };
    tenantUsers = [...tenantUsers, user];
    return HttpResponse.json(user, { status: 201 });
  }),
];
