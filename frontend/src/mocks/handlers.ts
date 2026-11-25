import { http, HttpResponse, type HttpHandler } from 'msw';
import type { ErrorCode, Paginated } from '@/api/types';
import { SCENARIOS } from './scenarios';
import {
  addSimulatedCase,
  dashboardSummary,
  meFor,
  riskCaseDetail,
  riskCaseList,
  supplierDetail,
  suppliers,
  users,
  type MockUser,
} from './fixtures';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 3600;

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): unknown {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4)));
}

const nowSec = () => Math.floor(Date.now() / 1000);

/** Fake UNSIGNED JWT (signature segment is the literal "mock"). */
export function makeToken(
  user: MockUser,
  kind: 'access' | 'refresh' = 'access',
  expiresInSeconds = kind === 'access' ? ACCESS_TTL_SECONDS : REFRESH_TTL_SECONDS,
): string {
  const payload = {
    token_type: kind,
    user_id: user.id,
    tenant_id: 'TEN-ACME',
    role: user.role,
    exp: nowSec() + expiresInSeconds,
    jti: Math.random().toString(36).slice(2),
  };
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.mock`;
}

interface Claims {
  token_type: string;
  user_id: string;
  exp: number;
}

function decode(token: string): Claims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[2] !== 'mock') return null;
    return b64urlDecode(parts[1]) as Claims;
  } catch {
    return null;
  }
}

function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  request: Request,
  details: Record<string, unknown> = {},
) {
  const cid = request.headers.get('X-Correlation-ID') ?? crypto.randomUUID();
  return HttpResponse.json(
    { error: { code, message, details, correlation_id: cid } },
    { status, headers: { 'X-Correlation-ID': cid } },
  );
}

/** Returns the authed user, or a 401 response. */
function authenticate(request: Request): MockUser | Response {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = token ? decode(token) : null;
  if (!claims || claims.token_type !== 'access') {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication credentials were not provided or are invalid.', request);
  }
  if (claims.exp <= nowSec()) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Access token expired.', request);
  }
  const user = users.find((u) => u.id === claims.user_id);
  if (!user) return errorResponse(401, 'UNAUTHENTICATED', 'Unknown user.', request);
  return user;
}

function paginate<T>(items: T[], url: URL): Paginated<T> {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size')) || 10));
  const start = (page - 1) * size;
  const link = (p: number) => {
    const u = new URL(url);
    u.searchParams.set('page', String(p));
    return u.toString();
  };
  return {
    count: items.length,
    next: start + size < items.length ? link(page + 1) : null,
    previous: page > 1 ? link(page - 1) : null,
    results: items.slice(start, start + size),
  };
}

/** Wrap a handler so it requires a valid Bearer token. */
function protectedRoute(
  fn: (ctx: { request: Request; params: Record<string, string | readonly string[] | undefined>; user: MockUser; url: URL }) => Response | Promise<Response>,
) {
  return ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return fn({ request, params, user, url: new URL(request.url) });
  };
}

const API = '*/api/v1';

const SUPPLIER_STATUSES = ['ACTIVE', 'ON_HOLD', 'INACTIVE'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const RISK_CASE_STATES = [
  'RECEIVED', 'ANALYZING', 'RECOMMENDATION_READY', 'PENDING_APPROVAL', 'APPROVED',
  'REJECTED', 'EXECUTING', 'EXECUTION_FAILED', 'RECOVERED', 'CLOSED',
];

/** 400 VALIDATION_ERROR when a filter value is not a known enum member (like a DRF ChoiceFilter). */
function badEnum(request: Request, field: string, value: string | null, allowed: string[]) {
  if (value === null || value === '' || allowed.includes(value)) return null;
  return errorResponse(400, 'VALIDATION_ERROR', `Invalid ${field}.`, request, {
    [field]: [`Select a valid choice. "${value}" is not one of ${allowed.join(', ')}.`],
  });
}

/** `from` (inclusive) / `to` (exclusive): YYYY-MM-DD = midnight UTC, or an ISO datetime. null = not given. */
function parseBound(v: string | null): number | null | 'invalid' {
  if (!v) return null;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v);
  return Number.isNaN(t) ? 'invalid' : t;
}

export const handlers: HttpHandler[] = [
  http.post(`${API}/auth/token`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
    if (!body.username || !body.password) {
      return errorResponse(400, 'VALIDATION_ERROR', 'username and password are required.', request, {
        ...(body.username ? {} : { username: ['This field is required.'] }),
        ...(body.password ? {} : { password: ['This field is required.'] }),
      });
    }
    const user = users.find((u) => u.username === body.username && u.password === body.password);
    if (!user) return errorResponse(401, 'UNAUTHENTICATED', 'No active account found with the given credentials.', request);
    return HttpResponse.json({ access: makeToken(user, 'access'), refresh: makeToken(user, 'refresh') });
  }),

  http.post(`${API}/auth/refresh`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { refresh?: string };
    const claims = body.refresh ? decode(body.refresh) : null;
    if (!claims || claims.token_type !== 'refresh' || claims.exp <= nowSec()) {
      return errorResponse(401, 'UNAUTHENTICATED', 'Token is invalid or expired.', request);
    }
    const user = users.find((u) => u.id === claims.user_id);
    if (!user) return errorResponse(401, 'UNAUTHENTICATED', 'Unknown user.', request);
    return HttpResponse.json({ access: makeToken(user, 'access') });
  }),

  http.get(`${API}/me`, protectedRoute(({ user }) => HttpResponse.json(meFor(user)))),

  http.get(
    `${API}/suppliers`,
    protectedRoute(({ url, request }) => {
      const status = url.searchParams.get('status');
      const risk = url.searchParams.get('risk_level');
      const search = url.searchParams.get('search')?.trim().toLowerCase();
      const bad =
        badEnum(request, 'status', status, SUPPLIER_STATUSES) ?? badEnum(request, 'risk_level', risk, SEVERITIES);
      if (bad) return bad;
      // Backend order: Supplier.Meta.ordering = erp_id.
      const filtered = suppliers
        .filter(
          (s) =>
            (!status || s.status === status) &&
            (!risk || s.risk_level === risk) &&
            (!search || s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)),
        )
        .sort((a, b) => a.id.localeCompare(b.id));
      return HttpResponse.json(paginate(filtered, url));
    }),
  ),

  http.get(
    `${API}/suppliers/:id`,
    protectedRoute(({ params, request }) => {
      const detail = supplierDetail(String(params.id));
      if (!detail) return errorResponse(404, 'NOT_FOUND', `Supplier ${params.id} not found.`, request);
      return HttpResponse.json(detail);
    }),
  ),

  http.get(`${API}/dashboard/summary`, protectedRoute(() => HttpResponse.json(dashboardSummary))),

  http.get(
    `${API}/risk-cases`,
    protectedRoute(({ url, request }) => {
      const status = url.searchParams.get('status');
      const severity = url.searchParams.get('severity');
      const from = parseBound(url.searchParams.get('from'));
      const to = parseBound(url.searchParams.get('to'));
      const bad =
        badEnum(request, 'status', status, RISK_CASE_STATES) ??
        badEnum(request, 'severity', severity, SEVERITIES) ??
        (from === 'invalid' ? errorResponse(400, 'VALIDATION_ERROR', 'Invalid from.', request, { from: ['Enter a valid date or datetime.'] }) : null) ??
        (to === 'invalid' ? errorResponse(400, 'VALIDATION_ERROR', 'Invalid to.', request, { to: ['Enter a valid date or datetime.'] }) : null);
      if (bad) return bad;
      // Backend order: RiskCase.Meta.ordering = -created_at, -id. `severity` filters RiskCase.risk_level.
      const filtered = riskCaseList
        .filter((c) => {
          const t = Date.parse(c.created_at);
          return (
            (!status || c.status === status) &&
            (!severity || c.severity === severity) &&
            (from === null || t >= (from as number)) &&
            (to === null || t < (to as number))
          );
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      return HttpResponse.json(paginate(filtered, url));
    }),
  ),

  http.get(
    `${API}/risk-cases/:id`,
    protectedRoute(({ params, request }) => {
      const detail = riskCaseDetail(String(params.id));
      if (!detail) return errorResponse(404, 'NOT_FOUND', `Risk case ${params.id} not found.`, request);
      return HttpResponse.json(detail);
    }),
  ),

  http.post(
    `${API}/demo/simulate-disruption`,
    protectedRoute(async ({ request, user }) => {
      if (user.role !== 'ADMIN') return errorResponse(403, 'FORBIDDEN', 'Admin role required.', request);
      const body = (await request.json().catch(() => ({}))) as { scenario?: string };
      if (!body.scenario) {
        return errorResponse(400, 'VALIDATION_ERROR', 'scenario is required.', request, {
          scenario: ['This field is required.'],
        });
      }
      const scenario = SCENARIOS.find((s) => s.name === body.scenario);
      if (!scenario) {
        return errorResponse(400, 'VALIDATION_ERROR', `Unknown scenario "${body.scenario}".`, request, {
          scenario: [`Choose one of: ${SCENARIOS.map((s) => s.name).join(', ')}.`],
        });
      }
      const { eventId } = addSimulatedCase(scenario);
      return HttpResponse.json(
        {
          event_id: eventId,
          correlation_id: request.headers.get('X-Correlation-ID') ?? crypto.randomUUID(),
          status: 'RECEIVED',
        },
        { status: 202 },
      );
    }),
  ),
];
