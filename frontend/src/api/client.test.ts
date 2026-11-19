import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { makeToken } from '@/mocks/handlers';
import { users } from '@/mocks/fixtures';
import { ApiError, apiFetch, login, logout, onLogout } from './client';
import { getAccessToken, getRefreshToken, setTokens } from './tokens';
import { getMe } from './endpoints';

const admin = users[0];
async function failure(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected rejection');
}
const expired = () => makeToken(admin, 'access', -60);

function countRefreshes() {
  const counter = { n: 0 };
  server.events.on('request:start', ({ request }) => {
    if (request.url.endsWith('/auth/refresh')) counter.n++;
  });
  return counter;
}

describe('login', () => {
  it('stores tokens', async () => {
    const t = await login('admin', 'demo123');
    expect(getAccessToken()).toBe(t.access);
    expect(getRefreshToken()).toBe(t.refresh);
  });

  it('bad credentials throw ApiError UNAUTHENTICATED', async () => {
    const err = await failure(login('admin', 'nope'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('UNAUTHENTICATED');
    expect(err.status).toBe(401);
    expect(getAccessToken()).toBeNull();
  });

  it('logout clears tokens and emits event', async () => {
    await login('admin', 'demo123');
    let fired = 0;
    const off = onLogout(() => fired++);
    logout();
    off();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(fired).toBe(1);
  });
});

describe('apiFetch', () => {
  it('sends Bearer and X-Correlation-ID uuid', async () => {
    const t = await login('manager', 'demo123');
    let seen: Headers | undefined;
    server.use(
      http.get('*/api/v1/me', ({ request }) => {
        seen = request.headers;
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiFetch('/me');
    expect(seen?.get('Authorization')).toBe(`Bearer ${t.access}`);
    expect(seen?.get('X-Correlation-ID')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('works end-to-end with getMe', async () => {
    await login('viewer', 'demo123');
    const me = await getMe();
    expect(me.role).toBe('VIEWER');
    expect(me.tenant.id).toBe('TEN-ACME');
  });

  it('parses ApiError from contract body', async () => {
    await login('admin', 'demo123');
    const err = await failure(apiFetch('/suppliers/SUP-9999'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.status).toBe(404);
    expect(err.message).toContain('SUP-9999');
    expect(err.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(err.details).toEqual({});
  });

  it('parses validation details', async () => {
    const err = await failure(login('', ''));
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(400);
    expect(err.details).toHaveProperty('username');
  });

  it('wraps non-JSON failures', async () => {
    server.use(http.get('*/api/v1/boom', () => new HttpResponse('oops', { status: 502 })));
    const err = await failure(apiFetch('/boom'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
  });
});

describe('401 refresh', () => {
  it('refreshes once and retries', async () => {
    const t = await login('admin', 'demo123');
    setTokens({ access: expired(), refresh: t.refresh });
    const c = countRefreshes();
    const me = await getMe();
    server.events.removeAllListeners();
    expect(me.user.username).toBe('admin');
    expect(c.n).toBe(1);
    expect(getAccessToken()).not.toBe(t.access);
  });

  it('two concurrent 401s share one refresh', async () => {
    const t = await login('admin', 'demo123');
    setTokens({ access: expired(), refresh: t.refresh });
    const c = countRefreshes();
    const [a, b] = await Promise.all([getMe(), apiFetch<{ count: number }>('/suppliers')]);
    server.events.removeAllListeners();
    expect(a.user.id).toBe(admin.id);
    expect(b.count).toBe(12);
    expect(c.n).toBe(1);
  });

  it('refresh failure clears tokens and emits logout', async () => {
    setTokens({ access: expired(), refresh: 'garbage' });
    let fired = 0;
    const off = onLogout(() => fired++);
    const err = await failure(getMe());
    off();
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(fired).toBe(1);
  });

  it('no refresh token: clears and emits logout', async () => {
    setTokens({ access: expired() });
    let fired = 0;
    const off = onLogout(() => fired++);
    await getMe().catch(() => undefined);
    off();
    expect(fired).toBe(1);
  });
});
