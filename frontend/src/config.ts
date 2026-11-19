/** Mocks are ON unless VITE_API_MOCK is exactly the string "false". */
export function parseApiMock(value: string | undefined): boolean {
  return value !== 'false';
}

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  apiMock: parseApiMock(import.meta.env.VITE_API_MOCK),
};
