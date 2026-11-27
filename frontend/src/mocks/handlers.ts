import { http, HttpResponse, type HttpHandler } from 'msw';
import { integrationHandlers } from './admin/integrations';
import type { ErrorCode, Paginated } from '@/api/types';
import { SCENARIOS } from './scenarios';
import { approvalHandlers } from './approvals';
import { auditHandlers } from './admin/audit';
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
import { whatIfHandlers } from './whatif';
import { adminSettingsHandlers } from './admin/settings';

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

/** DRF PageNumberPagination: default page size 25; `page_size` is honoured up to 100. */
const DEFAULT_PAGE_SIZE = 25;

function paginate<T>(items: T[], url: URL, request: Request): Paginated<T> | Response {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size')) || DEFAULT_PAGE_SIZE));
  const start = (page - 1) * size;
  // DRF answers 404 for a page past the end (page 1 of an empty list is fine).
  if (page > 1 && start >= items.length) {
    return errorResponse(404, 'NOT_FOUND', 'Invalid page.', request);
  }
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

/** `from` (inclusive) / `to` (exclusive): a date (UTC midnight) or a full ISO timestamp. NaN = invalid. */
function dateBound(raw: string | null): number | null {
  if (!raw) return null;
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw);
}

const SUPPLIER_STATUSES = ['ACTIVE', 'ON_HOLD', 'INACTIVE'];
const LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const CASE_STATES = [
  'RECEIVED', 'ANALYZING', 'RECOMMENDATION_READY', 'PENDING_APPROVAL', 'APPROVED',
  'REJECTED', 'EXECUTING', 'EXECUTION_FAILED', 'RECOVERED', 'CLOSED',
];

/** Backend answers 400 VALIDATION_ERROR for a filter value outside its enum / an unparseable date. */
function badFilter(request: Request, checks: [string, string | null, string[] | 'date'][]): Response | null {
  const details: Record<string, string[]> = {};
  for (const [name, value, allowed] of checks) {
    if (value === null || value === '') continue;
    const ok = allowed === 'date' ? !Number.isNaN(dateBound(value)) : allowed.includes(value);
    if (!ok) details[name] = [allowed === 'date' ? 'Enter a valid date.' : `"${value}" is not a valid choice.`];
  }
  return Object.keys(details).length
    ? errorResponse(400, 'VALIDATION_ERROR', 'Invalid filter value.', request, details)
    : null;
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

function paginated<T>(items: T[], url: URL, request: Request): Response {
  const result = paginate(items, url, request);
  return result instanceof Response ? result : HttpResponse.json(result);
}

const API = '*/api/v1';

export const handlers: HttpHandler[] = [
  ...approvalHandlers, // stateful R-05 overrides of /risk-cases* + decision/retry; must stay first
  ...adminSettingsHandlers,
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
      const bad = badFilter(request, [
        ['status', status, SUPPLIER_STATUSES],
        ['risk_level', risk, LEVELS],
      ]);
      if (bad) return bad;
      const search = url.searchParams.get('search')?.toLowerCase();
      const filtered = suppliers.filter(
        (s) =>
          (!status || s.status === status) &&
          (!risk || s.risk_level === risk) &&
          (!search || s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)),
      );
      return paginated(filtered, url, request);
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
      const bad = badFilter(request, [
        ['status', status, CASE_STATES],
        ['severity', severity, LEVELS],
        ['from', url.searchParams.get('from'), 'date'],
        ['to', url.searchParams.get('to'), 'date'],
      ]);
      if (bad) return bad;
      const from = dateBound(url.searchParams.get('from'));
      const to = dateBound(url.searchParams.get('to'));
      const filtered = riskCaseList.filter((c) => {
        const t = Date.parse(c.created_at);
        return (
          (!status || c.status === status) &&
          (!severity || c.severity === severity) &&
          (from === null || t >= from) &&
          (to === null || t < to)
        );
      });
      return paginated(filtered, url, request);
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
          scenario: scenario.name,
          event_id: eventId,
          sent: [
            {
              http_status: 202,
              event_id: eventId,
              correlation_id: request.headers.get('X-Correlation-ID') ?? crypto.randomUUID(),
              status: 'RECEIVED',
              risk_case_id: null,
            },
          ],
        },
        { status: 202 },
      );
    }),
  ),
  ...whatIfHandlers,
  ...integrationHandlers,
  ...auditHandlers,
];
