import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { server } from '@/mocks/server';
import { clearTokens } from '@/api/tokens';
import { resetMockState } from '@/mocks/fixtures';
import { resetApprovalsMock } from '@/mocks/approvals';
import { resetAdminSettingsMock } from '@/mocks/admin/settings';

// Default findBy*/waitFor timeout is 1 s; under CPU load (parallel jsdom workers) renders take 2+ s.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockState();
  resetApprovalsMock();
  clearTokens();
  resetAdminSettingsMock();
  document.documentElement.classList.remove('dark');
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

// jsdom lacks matchMedia
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom lacks ResizeObserver / scrollIntoView (needed by Radix ScrollArea and cmdk)
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
