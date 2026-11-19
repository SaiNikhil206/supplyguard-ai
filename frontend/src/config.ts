/**
 * VITE_API_MOCK: "true" / "false" wins; unset or anything else falls back to
 * `fallback` (import.meta.env.DEV: mocks on in dev, off in production builds).
 */
export function parseApiMock(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  apiMock: parseApiMock(import.meta.env.VITE_API_MOCK, import.meta.env.DEV),
};
