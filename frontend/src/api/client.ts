import { config } from '@/config';
import type { ApiErrorBody, ErrorCode, TokenPair } from './types';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens';

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  details: Record<string, unknown>;
  correlationId: string | null;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    status: number;
    details?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details ?? {};
    this.correlationId = opts.correlationId ?? null;
  }
}

// ---- logout event ----
type LogoutListener = () => void;
const logoutListeners = new Set<LogoutListener>();

/** Fires when refresh fails or logout() is called. Returns unsubscribe. */
export function onLogout(listener: LogoutListener): () => void {
  logoutListeners.add(listener);
  return () => {
    logoutListeners.delete(listener);
  };
}

function emitLogout() {
  logoutListeners.forEach((l) => l());
}

export function newCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function url(path: string): string {
  return `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function toApiError(res: Response): Promise<ApiError> {
  const headerCid = res.headers.get('X-Correlation-ID');
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body?.error?.code) {
      return new ApiError({
        code: body.error.code,
        message: body.error.message ?? res.statusText,
        status: res.status,
        details: body.error.details,
        correlationId: body.error.correlation_id ?? headerCid,
      });
    }
  } catch {
    /* non-JSON body */
  }
  return new ApiError({
    code: res.status === 401 ? 'UNAUTHENTICATED' : 'DOWNSTREAM_ERROR',
    message: res.statusText || `HTTP ${res.status}`,
    status: res.status,
    correlationId: headerCid,
  });
}

function buildInit(init: RequestInit | undefined, withAuth: boolean): RequestInit {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('X-Correlation-ID')) headers.set('X-Correlation-ID', newCorrelationId());
  const token = getAccessToken();
  if (withAuth && token) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

async function rawFetch(path: string, init: RequestInit | undefined, withAuth: boolean) {
  try {
    return await fetch(url(path), buildInit(init, withAuth));
  } catch (e) {
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: e instanceof Error ? e.message : 'Network error',
      status: 0,
    });
  }
}

// ---- single-flight refresh ----
let refreshInFlight: Promise<void> | null = null;

function refreshAccess(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refresh = getRefreshToken();
        if (!refresh) throw new ApiError({ code: 'UNAUTHENTICATED', message: 'No refresh token', status: 401 });
        const res = await rawFetch(
          '/auth/refresh',
          { method: 'POST', body: JSON.stringify({ refresh }) },
          false,
        );
        if (!res.ok) throw await toApiError(res);
        const data = (await res.json()) as { access: string; refresh?: string };
        setTokens({ access: data.access, refresh: data.refresh });
      } catch (e) {
        // Only an explicit rejection of the refresh token ends the session (emitted once here,
        // not once per waiting request); network/5xx errors keep tokens so a later retry can succeed.
        if (e instanceof ApiError && (e.status === 400 || e.status === 401)) {
          clearTokens();
          emitLogout();
        }
        throw e;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // One correlation id per logical call, reused on the post-refresh retry.
  const headers = new Headers(init?.headers);
  if (!headers.has('X-Correlation-ID')) headers.set('X-Correlation-ID', newCorrelationId());
  const req: RequestInit = { ...init, headers };

  const usedToken = getAccessToken();
  let res = await rawFetch(path, req, true);

  if (res.status === 401) {
    const current = getAccessToken();
    // If another request already refreshed, just retry with the new token.
    if (!current || current === usedToken) {
      try {
        await refreshAccess();
      } catch (e) {
        // Logout was already emitted inside the shared refresh.
        if (e instanceof ApiError && (e.status === 400 || e.status === 401)) {
          throw await toApiError(res);
        }
        throw e;
      }
    }
    res = await rawFetch(path, req, true);
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(username: string, password: string): Promise<TokenPair> {
  const res = await rawFetch(
    '/auth/token',
    { method: 'POST', body: JSON.stringify({ username, password }) },
    false,
  );
  if (!res.ok) throw await toApiError(res);
  const tokens = (await res.json()) as TokenPair;
  setTokens(tokens);
  return tokens;
}

export function logout(): void {
  clearTokens();
  emitLogout();
}
